from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta
from statistics import median

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.time import user_today
from app.models.planning import DailyPlan, DailyPlanItem, TaskOccurrence
from app.models.profile import UserProfile
from app.models.route import Route, RouteStage, RouteWeek, Task
from app.models.user import User
from app.schemas.planning import (
    BlockRequest,
    CompleteRequest,
    ForecastOut,
    OccurrenceOut,
    OccurrenceUpdate,
    SkipRequest,
    SplitRequest,
    TodayItem,
    TodayItemCreate,
    TodayResponse,
    TodaySummary,
)
from app.services.import_validation import ALLOWED_TASK_TYPES


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _capacity(db: Session, user: User) -> int:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        return 96
    return max(int(profile.daily_available_minutes * float(profile.planning_capacity_factor)), 30)


def logical_today(db: Session, user: User, on_date: date | None = None) -> date:
    if on_date is not None:
        return on_date
    profile = db.get(UserProfile, user.id)
    boundary = profile.day_boundary_time.hour if profile else 4
    return user_today(user.timezone, boundary)


def get_plan(db: Session, user: User, plan_date: date) -> DailyPlan | None:
    return db.scalar(
        select(DailyPlan).where(
            DailyPlan.user_id == user.id,
            DailyPlan.plan_date == plan_date,
        )
    )


def get_occurrence(db: Session, user: User, occurrence_id: str) -> TaskOccurrence:
    occurrence = db.scalar(
        select(TaskOccurrence).where(
            TaskOccurrence.id == occurrence_id,
            TaskOccurrence.user_id == user.id,
        )
    )
    if occurrence is None:
        raise AppError("OCCURRENCE_NOT_FOUND", "任务实例不存在", status_code=404)
    return occurrence


def carry_over(db: Session, user: User, on_date: date) -> int:
    old_occurrences = list(
        db.scalars(
            select(TaskOccurrence).where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.occurrence_date < on_date,
                TaskOccurrence.status.in_(["pending", "in_progress", "blocked"]),
            )
        )
    )
    moved = 0
    for old in old_occurrences:
        existing = db.scalar(
            select(TaskOccurrence).where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.task_id == old.task_id,
                TaskOccurrence.occurrence_date == on_date,
                TaskOccurrence.split_index == old.split_index,
            )
        )
        if existing is not None:
            old.status = "postponed"
            continue
        remaining = max(old.remaining_minutes or old.planned_minutes, 15)
        new_status = "blocked" if old.status == "blocked" else "pending"
        db.add(
            TaskOccurrence(
                user_id=user.id,
                task_id=old.task_id,
                occurrence_date=on_date,
                timezone=old.timezone or user.timezone,
                status=new_status,
                priority_snapshot=old.priority_snapshot,
                planned_minutes=remaining,
                remaining_minutes=remaining,
                carry_over_from_id=old.id,
                postpone_count=old.postpone_count + 1,
                block_reason=old.block_reason if new_status == "blocked" else None,
                split_index=old.split_index,
                parent_occurrence_id=old.parent_occurrence_id,
            )
        )
        old.status = "postponed"
        moved += 1
    db.commit()
    return moved


def _task_sort_key(task: Task) -> tuple[int, date, int]:
    priority = {"P0": 0, "P1": 1, "P2": 2}.get(task.priority, 1)
    return priority, task.planned_date or date.max, task.estimated_minutes


def _eligible_tasks(db: Session, user: User, on_date: date) -> list[Task]:
    """Active route/manual tasks due today and not already instantiated."""
    completed_task_ids = select(TaskOccurrence.task_id).where(
        TaskOccurrence.user_id == user.id,
        TaskOccurrence.status == "completed",
    )
    today_task_ids = select(TaskOccurrence.task_id).where(
        TaskOccurrence.user_id == user.id,
        TaskOccurrence.occurrence_date == on_date,
    )
    tasks = list(
        db.scalars(
            select(Task)
            .outerjoin(Route, Task.route_id == Route.id)
            .where(
                Task.user_id == user.id,
                Task.status == "active",
                Task.deleted_at.is_(None),
                Task.planned_date.is_not(None),
                Task.planned_date <= on_date,
                Task.id.not_in(completed_task_ids),
                Task.id.not_in(today_task_ids),
                or_(Task.route_id.is_(None), Route.status == "active"),
            )
        )
    )
    tasks.sort(key=_task_sort_key)
    return tasks


def _attach_unlinked_occurrences(db: Session, plan: DailyPlan, user: User) -> None:
    occurrences = list(
        db.scalars(
            select(TaskOccurrence).where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.occurrence_date == plan.plan_date,
                TaskOccurrence.daily_plan_id.is_(None),
                TaskOccurrence.status.in_(["pending", "in_progress", "blocked"]),
            )
        )
    )
    if not occurrences:
        return
    max_order = db.scalar(
        select(func.max(DailyPlanItem.order_no)).where(
            DailyPlanItem.daily_plan_id == plan.id
        )
    ) or 0
    summary = plan.summary_json or {}
    selected = summary.setdefault("selected", [])
    planned_minutes = int(summary.get("planned_minutes") or 0)
    for offset, occurrence in enumerate(occurrences, start=1):
        occurrence.daily_plan_id = plan.id
        db.add(
            DailyPlanItem(
                daily_plan_id=plan.id,
                task_occurrence_id=occurrence.id,
                order_no=int(max_order) + offset,
                planned_minutes=occurrence.planned_minutes,
            )
        )
        planned_minutes += occurrence.planned_minutes
        selected.append(
            {
                "occurrence_id": occurrence.id,
                "task_id": occurrence.task_id,
                "reason": "顺延任务",
            }
        )
    summary["planned_minutes"] = planned_minutes
    summary["over_capacity"] = planned_minutes > plan.capacity_minutes
    summary.setdefault("focus", "今天先处理顺延任务")
    plan.summary_json = summary
    db.commit()


def _fill_existing_plan(db: Session, user: User, plan: DailyPlan) -> None:
    """Backfill route tasks when a plan was created before the route existed."""
    _attach_unlinked_occurrences(db, plan, user)
    rows = db.execute(
        select(DailyPlanItem, TaskOccurrence, Task)
        .join(TaskOccurrence, DailyPlanItem.task_occurrence_id == TaskOccurrence.id)
        .join(Task, TaskOccurrence.task_id == Task.id)
        .where(
            DailyPlanItem.daily_plan_id == plan.id,
            TaskOccurrence.status != "abandoned",
        )
        .order_by(DailyPlanItem.order_no)
    ).all()
    existing_count = len(rows)
    planned_minutes = sum(item.planned_minutes for item, _, _ in rows)
    summary = dict(plan.summary_json or {})
    selected_payload = list(summary.get("selected", []))
    deferred = list(summary.get("deferred", []))
    next_order = (
        db.scalar(
            select(func.max(DailyPlanItem.order_no)).where(
                DailyPlanItem.daily_plan_id == plan.id
            )
        )
        or 0
    ) + 1
    added_titles: list[str] = []

    for task in _eligible_tasks(db, user, plan.plan_date):
        if existing_count >= 6:
            deferred.append(
                {"task_id": task.id, "title": task.title, "reason": "超过每日任务数上限"}
            )
            continue
        if planned_minutes + task.estimated_minutes > plan.capacity_minutes:
            deferred.append(
                {"task_id": task.id, "title": task.title, "reason": "容量不足"}
            )
            continue
        reason = "P0 路线任务" if task.priority == "P0" else "计划日期到期"
        if task.route_id is None:
            reason = "手动任务"
        occurrence = TaskOccurrence(
            user_id=user.id,
            task_id=task.id,
            daily_plan_id=plan.id,
            occurrence_date=plan.plan_date,
            timezone=user.timezone,
            status="pending",
            priority_snapshot=task.priority,
            planned_minutes=task.estimated_minutes,
            remaining_minutes=task.estimated_minutes,
        )
        db.add(occurrence)
        db.flush()
        db.add(
            DailyPlanItem(
                daily_plan_id=plan.id,
                task_occurrence_id=occurrence.id,
                order_no=next_order,
                planned_minutes=task.estimated_minutes,
                is_optional=task.priority == "P2",
            )
        )
        next_order += 1
        existing_count += 1
        planned_minutes += task.estimated_minutes
        added_titles.append(task.title)
        selected_payload.append(
            {
                "occurrence_id": occurrence.id,
                "task_id": task.id,
                "title": task.title,
                "reason": reason,
            }
        )

    if not added_titles:
        return
    summary["selected"] = selected_payload
    summary["deferred"] = deferred
    summary["planned_minutes"] = planned_minutes
    summary["over_capacity"] = planned_minutes > plan.capacity_minutes
    if not rows:
        summary["focus"] = added_titles[0]
    plan.summary_json = summary
    plan.generation_version = (plan.generation_version or 1) + 1
    plan.generated_at = _naive_utcnow()
    db.commit()
    db.refresh(plan)


def generate_daily_plan(db: Session, user: User, on_date: date) -> DailyPlan:
    existing = get_plan(db, user, on_date)
    if existing is not None:
        _fill_existing_plan(db, user, existing)
        return existing

    capacity = _capacity(db, user)
    tasks = _eligible_tasks(db, user, on_date)

    carried = list(
        db.scalars(
            select(TaskOccurrence)
            .where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.occurrence_date == on_date,
                TaskOccurrence.daily_plan_id.is_(None),
                TaskOccurrence.status.in_(["pending", "in_progress", "blocked"]),
            )
            .order_by(TaskOccurrence.created_at)
        )
    )

    selected: list[tuple[TaskOccurrence | None, Task, int, str]] = []
    total_minutes = 0
    for occurrence in carried:
        task = db.get(Task, occurrence.task_id)
        if task is None:
            continue
        selected.append((occurrence, task, occurrence.planned_minutes, "顺延任务"))
        total_minutes += occurrence.planned_minutes

    deferred: list[dict] = []
    over_capacity = total_minutes > capacity
    for task in tasks:
        if len(selected) >= 6:
            deferred.append({"task_id": task.id, "title": task.title, "reason": "超过每日任务数上限"})
            continue
        if total_minutes + task.estimated_minutes > capacity:
            deferred.append({"task_id": task.id, "title": task.title, "reason": "容量不足"})
            continue
        reason = "P0 路线任务" if task.priority == "P0" else "计划日期到期"
        if task.route_id is None:
            reason = "手动任务"
        selected.append((None, task, task.estimated_minutes, reason))
        total_minutes += task.estimated_minutes

    focus = selected[0][1].title if selected else "今天没有排任务，休息或补进度"
    plan = DailyPlan(
        user_id=user.id,
        plan_date=on_date,
        capacity_minutes=capacity,
        status="active",
        generated_at=_naive_utcnow(),
        generation_version=1,
    )
    db.add(plan)
    db.flush()

    selected_payload = []
    for index, (occurrence, task, minutes, reason) in enumerate(selected, start=1):
        if occurrence is None:
            occurrence = TaskOccurrence(
                user_id=user.id,
                task_id=task.id,
                daily_plan_id=plan.id,
                occurrence_date=on_date,
                timezone=user.timezone,
                status="pending",
                priority_snapshot=task.priority,
                planned_minutes=minutes,
                remaining_minutes=minutes,
            )
            db.add(occurrence)
            db.flush()
        else:
            occurrence.daily_plan_id = plan.id
        db.add(
            DailyPlanItem(
                daily_plan_id=plan.id,
                task_occurrence_id=occurrence.id,
                order_no=index,
                planned_minutes=minutes,
                is_optional=task.priority == "P2",
            )
        )
        selected_payload.append(
            {
                "occurrence_id": occurrence.id,
                "task_id": task.id,
                "title": task.title,
                "reason": reason,
            }
        )

    plan.summary_json = {
        "focus": focus,
        "capacity_minutes": capacity,
        "planned_minutes": total_minutes,
        "over_capacity": over_capacity,
        "selected": selected_payload,
        "deferred": deferred,
    }
    db.commit()
    db.refresh(plan)
    return plan


def ensure_today(db: Session, user: User, on_date: date | None = None) -> DailyPlan:
    day = logical_today(db, user, on_date)
    carry_over(db, user, day)
    return generate_daily_plan(db, user, day)


def _today_item(
    db: Session,
    plan_item: DailyPlanItem,
    occurrence: TaskOccurrence,
    task: Task,
    reason: str,
) -> TodayItem:
    stage = db.get(RouteStage, task.stage_id) if task.stage_id else None
    week = db.get(RouteWeek, task.week_id) if task.week_id else None
    base = OccurrenceOut.model_validate(occurrence).model_dump()
    return TodayItem(
        **base,
        title=task.title,
        task_type=task.task_type,
        stage_name=stage.name if stage else None,
        week_focus=week.focus if week else None,
        source_type=task.source_type,
        why=reason,
        is_optional=plan_item.is_optional,
        carry_over=occurrence.carry_over_from_id is not None,
    )


def get_today(db: Session, user: User, on_date: date | None = None) -> TodayResponse:
    plan = ensure_today(db, user, on_date)
    rows = db.execute(
        select(DailyPlanItem, TaskOccurrence, Task)
        .join(TaskOccurrence, DailyPlanItem.task_occurrence_id == TaskOccurrence.id)
        .join(Task, TaskOccurrence.task_id == Task.id)
        .where(
            DailyPlanItem.daily_plan_id == plan.id,
            TaskOccurrence.status != "abandoned",
        )
        .order_by(DailyPlanItem.order_no)
    ).all()
    summary = plan.summary_json or {}
    reason_map = {
        item["occurrence_id"]: item["reason"]
        for item in summary.get("selected", [])
        if "occurrence_id" in item
    }
    items = [
        _today_item(
            db,
            plan_item,
            occurrence,
            task,
            reason_map.get(occurrence.id, "今日计划"),
        )
        for plan_item, occurrence, task in rows
    ]
    planned_tasks = len(items)
    completed_tasks = sum(1 for item in items if item.status == "completed")
    planned_minutes = sum(item.planned_minutes for item in items)
    actual_minutes = sum(item.actual_minutes or 0 for item in items)
    completion_rate = completed_tasks / planned_tasks if planned_tasks else 0.0
    return TodayResponse(
        plan_id=plan.id,
        date=plan.plan_date,
        timezone=user.timezone,
        capacity_minutes=plan.capacity_minutes,
        summary=TodaySummary(
            planned_tasks=planned_tasks,
            completed_tasks=completed_tasks,
            planned_minutes=planned_minutes,
            actual_minutes=actual_minutes,
            completion_rate=completion_rate,
        ),
        items=items,
        carry_over=[item for item in items if item.carry_over],
    )


def add_today_item(
    db: Session,
    user: User,
    payload: TodayItemCreate,
    on_date: date | None = None,
) -> TodayResponse:
    """Add an existing task or an ad-hoc task to an existing daily plan."""
    day = logical_today(db, user, on_date)
    plan = ensure_today(db, user, on_date)
    created_item = False

    if payload.task_id:
        task = db.scalar(
            select(Task).where(
                Task.id == payload.task_id,
                Task.user_id == user.id,
                Task.status == "active",
                Task.deleted_at.is_(None),
            )
        )
        if task is None:
            raise AppError("TASK_NOT_FOUND", "任务不存在", status_code=404)
        occurrence = db.scalar(
            select(TaskOccurrence).where(
                TaskOccurrence.user_id == user.id,
                TaskOccurrence.task_id == task.id,
                TaskOccurrence.occurrence_date == day,
                TaskOccurrence.split_index == 0,
            )
        )
        if occurrence is None:
            minutes = task.estimated_minutes
            occurrence = TaskOccurrence(
                user_id=user.id,
                task_id=task.id,
                daily_plan_id=plan.id,
                occurrence_date=day,
                timezone=user.timezone,
                status="pending",
                priority_snapshot=task.priority,
                planned_minutes=minutes,
                remaining_minutes=minutes,
            )
            db.add(occurrence)
            db.flush()
        elif occurrence.status not in {"pending", "in_progress", "blocked"}:
            raise AppError(
                "TODAY_ITEM_INVALID",
                "该任务今天已有执行记录，不能重复加入",
                status_code=409,
            )
        else:
            occurrence.daily_plan_id = plan.id
            minutes = occurrence.planned_minutes
    else:
        if payload.task_type not in ALLOWED_TASK_TYPES:
            raise AppError("INVALID_TASK_TYPE", "任务类型无效", status_code=422)
        minutes = payload.estimated_minutes
        task = Task(
            user_id=user.id,
            title=payload.title or "手动任务",
            task_type=payload.task_type,
            priority=payload.priority,
            estimated_minutes=minutes,
            planned_date=day,
            deliverable="手动添加",
            acceptance_criteria="完成",
            resources_json=[],
            capability_tags_json=[],
            needs_review=False,
            is_splittable=True,
            source_type="manual",
            status="active",
        )
        db.add(task)
        db.flush()
        occurrence = TaskOccurrence(
            user_id=user.id,
            task_id=task.id,
            daily_plan_id=plan.id,
            occurrence_date=day,
            timezone=user.timezone,
            status="pending",
            priority_snapshot=task.priority,
            planned_minutes=minutes,
            remaining_minutes=minutes,
        )
        db.add(occurrence)
        db.flush()

    if payload.note:
        occurrence.note = payload.note

    plan_item = db.scalar(
        select(DailyPlanItem).where(
            DailyPlanItem.daily_plan_id == plan.id,
            DailyPlanItem.task_occurrence_id == occurrence.id,
        )
    )
    if plan_item is None:
        next_order = (
            db.scalar(
                select(func.max(DailyPlanItem.order_no)).where(
                    DailyPlanItem.daily_plan_id == plan.id
                )
            )
            or 0
        ) + 1
        plan_item = DailyPlanItem(
            daily_plan_id=plan.id,
            task_occurrence_id=occurrence.id,
            order_no=next_order,
            planned_minutes=minutes,
            is_optional=task.priority == "P2",
        )
        db.add(plan_item)
        db.flush()
        created_item = True

    if created_item:
        summary = dict(plan.summary_json or {})
        selected = list(summary.get("selected", []))
        if not any(item.get("occurrence_id") == occurrence.id for item in selected):
            selected.append(
                {
                    "occurrence_id": occurrence.id,
                    "task_id": task.id,
                    "title": task.title,
                    "reason": "手动添加",
                }
            )
        planned_minutes = int(
            db.scalar(
                select(func.sum(DailyPlanItem.planned_minutes)).where(
                    DailyPlanItem.daily_plan_id == plan.id
                )
            )
            or 0
        )
        summary["selected"] = selected
        summary["planned_minutes"] = planned_minutes
        summary["over_capacity"] = planned_minutes > plan.capacity_minutes
        if not summary.get("focus"):
            summary["focus"] = task.title
        plan.summary_json = summary
        plan.generation_version = (plan.generation_version or 1) + 1
        plan.generated_at = _naive_utcnow()

    db.commit()
    return get_today(db, user, on_date)


def start_occurrence(db: Session, user: User, occurrence_id: str) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status == "pending":
        occurrence.status = "in_progress"
        occurrence.started_at = _naive_utcnow()
        db.commit()
        db.refresh(occurrence)
    elif occurrence.status != "in_progress":
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能开始", status_code=409)
    return OccurrenceOut.model_validate(occurrence)


def complete_occurrence(
    db: Session, user: User, occurrence_id: str, payload: CompleteRequest
) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status not in {"pending", "in_progress"}:
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能完成", status_code=409)
    occurrence.status = "completed"
    occurrence.actual_minutes = (
        payload.actual_minutes if payload.actual_minutes is not None else occurrence.planned_minutes
    )
    occurrence.remaining_minutes = 0
    occurrence.completed_at = _naive_utcnow()
    if payload.note is not None:
        occurrence.note = payload.note
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def postpone_occurrence(db: Session, user: User, occurrence_id: str) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status not in {"pending", "in_progress"}:
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能延期", status_code=409)
    next_date = occurrence.occurrence_date + timedelta(days=1)
    existing = db.scalar(
        select(TaskOccurrence).where(
            TaskOccurrence.user_id == user.id,
            TaskOccurrence.task_id == occurrence.task_id,
            TaskOccurrence.occurrence_date == next_date,
            TaskOccurrence.split_index == occurrence.split_index,
        )
    )
    remaining = max(occurrence.remaining_minutes or occurrence.planned_minutes, 15)
    if existing is None:
        db.add(
            TaskOccurrence(
                user_id=user.id,
                task_id=occurrence.task_id,
                occurrence_date=next_date,
                timezone=occurrence.timezone or user.timezone,
                status="pending",
                priority_snapshot=occurrence.priority_snapshot,
                planned_minutes=remaining,
                remaining_minutes=remaining,
                carry_over_from_id=occurrence.id,
                postpone_count=occurrence.postpone_count + 1,
                split_index=occurrence.split_index,
                parent_occurrence_id=occurrence.parent_occurrence_id,
            )
        )
    occurrence.status = "postponed"
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def skip_occurrence(
    db: Session, user: User, occurrence_id: str, payload: SkipRequest
) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status not in {"pending", "in_progress"}:
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能跳过", status_code=409)
    occurrence.status = "skipped"
    occurrence.skip_reason = payload.reason
    task = db.get(Task, occurrence.task_id)
    if task is not None:
        task.planned_date = None
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def block_occurrence(
    db: Session, user: User, occurrence_id: str, payload: BlockRequest
) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status not in {"pending", "in_progress"}:
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能阻塞", status_code=409)
    occurrence.status = "blocked"
    occurrence.block_reason = payload.reason
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def unblock_occurrence(db: Session, user: User, occurrence_id: str) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status != "blocked":
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能解除阻塞", status_code=409)
    occurrence.status = "pending"
    occurrence.block_reason = None
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def abandon_occurrence(db: Session, user: User, occurrence_id: str) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status not in {"pending", "in_progress", "blocked"}:
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能放弃", status_code=409)
    occurrence.status = "abandoned"
    task = db.get(Task, occurrence.task_id)
    if task is not None:
        task.status = "archived"
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def update_occurrence(
    db: Session, user: User, occurrence_id: str, payload: OccurrenceUpdate
) -> OccurrenceOut:
    occurrence = get_occurrence(db, user, occurrence_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(occurrence, field, value)
    if occurrence.actual_minutes is not None and occurrence.remaining_minutes == 0:
        occurrence.remaining_minutes = max(
            occurrence.planned_minutes - occurrence.actual_minutes, 0
        )
    db.commit()
    db.refresh(occurrence)
    return OccurrenceOut.model_validate(occurrence)


def split_occurrence(
    db: Session, user: User, occurrence_id: str, payload: SplitRequest
) -> list[OccurrenceOut]:
    occurrence = get_occurrence(db, user, occurrence_id)
    if occurrence.status not in {"pending", "in_progress"}:
        raise AppError("OCCURRENCE_INVALID_STATE", "当前任务状态不能拆分", status_code=409)
    parts = payload.parts
    base_minutes = max(occurrence.planned_minutes // parts, 15)
    children: list[TaskOccurrence] = []
    for index in range(1, parts + 1):
        minutes = base_minutes
        if index == parts:
            minutes = max(occurrence.planned_minutes - base_minutes * (parts - 1), 15)
        child = TaskOccurrence(
            user_id=user.id,
            task_id=occurrence.task_id,
            daily_plan_id=occurrence.daily_plan_id,
            occurrence_date=occurrence.occurrence_date,
            timezone=occurrence.timezone,
            status="pending",
            priority_snapshot=occurrence.priority_snapshot,
            planned_minutes=minutes,
            remaining_minutes=minutes,
            split_index=index,
            parent_occurrence_id=occurrence.id,
        )
        db.add(child)
        db.flush()
        if occurrence.daily_plan_id:
            current_max = db.scalar(
                select(func.max(DailyPlanItem.order_no)).where(
                    DailyPlanItem.daily_plan_id == occurrence.daily_plan_id
                )
            ) or 0
            db.add(
                DailyPlanItem(
                    daily_plan_id=occurrence.daily_plan_id,
                    task_occurrence_id=child.id,
                    order_no=int(current_max) + index,
                    planned_minutes=minutes,
                )
            )
        children.append(child)
    occurrence.status = "abandoned"
    occurrence.note = f"已拆分为 {parts} 个子任务"
    db.commit()
    for child in children:
        db.refresh(child)
    return [OccurrenceOut.model_validate(child) for child in children]


def forecast_route(db: Session, user: User, route_id: str) -> ForecastOut:
    route = db.scalar(
        select(Route).where(
            Route.id == route_id,
            Route.user_id == user.id,
            Route.deleted_at.is_(None),
        )
    )
    if route is None:
        raise AppError("ROUTE_NOT_FOUND", "路线不存在", status_code=404)

    tasks = list(
        db.scalars(
            select(Task).where(
                Task.route_id == route.id,
                Task.user_id == user.id,
                Task.status == "active",
                Task.deleted_at.is_(None),
                Task.planned_date.is_not(None),
            )
        )
    )
    remaining_minutes = 0
    for task in tasks:
        occurrences = list(
            db.scalars(select(TaskOccurrence).where(TaskOccurrence.task_id == task.id))
        )
        if any(item.status == "completed" for item in occurrences):
            continue
        active = [
            item
            for item in occurrences
            if item.status in {"pending", "in_progress", "blocked"}
        ]
        if active:
            remaining_minutes += sum(item.remaining_minutes for item in active)
        else:
            remaining_minutes += task.estimated_minutes

    capacity = route.daily_capacity_minutes or _capacity(db, user)
    since = _naive_utcnow() - timedelta(days=14)
    completed = db.execute(
        select(
            func.date(TaskOccurrence.completed_at),
            func.sum(TaskOccurrence.actual_minutes),
        )
        .join(Task, TaskOccurrence.task_id == Task.id)
        .where(
            Task.route_id == route.id,
            TaskOccurrence.status == "completed",
            TaskOccurrence.completed_at.is_not(None),
            TaskOccurrence.completed_at >= since,
        )
        .group_by(func.date(TaskOccurrence.completed_at))
    ).all()
    daily_totals = [int(total or 0) for _, total in completed if total]
    if len(daily_totals) >= 5:
        throughput = max(int(median(daily_totals)), 30)
    else:
        throughput = max(capacity, 30)
    forecast_days = math.ceil(remaining_minutes / throughput * 1.1) if remaining_minutes else 0
    forecast_end = date.today() + timedelta(days=forecast_days)
    route.forecast_end_date = forecast_end
    db.commit()
    return ForecastOut(
        route_id=route.id,
        remaining_minutes=remaining_minutes,
        throughput_minutes=throughput,
        forecast_days=forecast_days,
        forecast_end_date=forecast_end,
    )

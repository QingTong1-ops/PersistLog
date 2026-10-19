from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.profile import UserProfile
from app.models.route import Route, RouteStage, RouteVersion, RouteWeek, Task
from app.models.user import User
from app.schemas.route import (
    RouteAdjust,
    RouteCreate,
    RouteDetail,
    RouteUpdate,
    StageCreate,
    StageUpdate,
    TaskOut,
    WeekCreate,
    WeekUpdate,
)
from app.services import job_target_service


def _capacity(db: Session, user: User) -> int:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        return 96
    return max(int(profile.daily_available_minutes * float(profile.planning_capacity_factor)), 30)


def get_route(db: Session, user: User, route_id: str) -> Route:
    route = db.scalar(
        select(Route).where(
            Route.id == route_id,
            Route.user_id == user.id,
            Route.deleted_at.is_(None),
        )
    )
    if route is None:
        raise AppError("ROUTE_NOT_FOUND", "路线不存在", status_code=404)
    return route


def get_stage(db: Session, route: Route, stage_id: str) -> RouteStage:
    stage = db.scalar(
        select(RouteStage).where(
            RouteStage.id == stage_id,
            RouteStage.route_id == route.id,
        )
    )
    if stage is None:
        raise AppError("STAGE_NOT_FOUND", "阶段不存在", status_code=404)
    return stage


def get_week(db: Session, stage: RouteStage, week_id: str) -> RouteWeek:
    week = db.scalar(
        select(RouteWeek).where(
            RouteWeek.id == week_id,
            RouteWeek.stage_id == stage.id,
        )
    )
    if week is None:
        raise AppError("WEEK_NOT_FOUND", "周计划不存在", status_code=404)
    return week


def list_routes(db: Session, user: User, status: str | None = None) -> list[Route]:
    statement = select(Route).where(Route.user_id == user.id, Route.deleted_at.is_(None))
    if status:
        statement = statement.where(Route.status == status)
    statement = statement.order_by(Route.created_at.desc())
    return list(db.scalars(statement))


def _snapshot(db: Session, route: Route) -> dict[str, Any]:
    stages = list(
        db.scalars(
            select(RouteStage)
            .where(RouteStage.route_id == route.id)
            .order_by(RouteStage.order_no)
        )
    )
    stage_payloads = []
    for stage in stages:
        weeks = list(
            db.scalars(
                select(RouteWeek)
                .where(RouteWeek.stage_id == stage.id)
                .order_by(RouteWeek.week_no)
            )
        )
        week_payloads = []
        for week in weeks:
            tasks = list(
                db.scalars(
                    select(Task)
                    .where(
                        Task.week_id == week.id,
                        Task.deleted_at.is_(None),
                        Task.status == "active",
                    )
                    .order_by(Task.planned_date, Task.created_at)
                )
            )
            week_payloads.append(
                {
                    "week_no": week.week_no,
                    "focus": week.focus,
                    "milestone": week.milestone,
                    "start_date": week.start_date.isoformat() if week.start_date else None,
                    "end_date": week.end_date.isoformat() if week.end_date else None,
                    "tasks": [
                        {
                            "title": task.title,
                            "description": task.description,
                            "learning_objective": task.learning_objective,
                            "task_type": task.task_type,
                            "priority": task.priority,
                            "estimated_minutes": task.estimated_minutes,
                            "planned_date": (
                                task.planned_date.isoformat() if task.planned_date else None
                            ),
                            "deliverable": task.deliverable,
                            "acceptance_criteria": task.acceptance_criteria,
                            "resources": task.resources_json or [],
                            "capability_tags": task.capability_tags_json or [],
                        }
                        for task in tasks
                    ],
                }
            )
        stage_payloads.append(
            {
                "name": stage.name,
                "objective": stage.objective,
                "order_no": stage.order_no,
                "start_date": stage.start_date.isoformat() if stage.start_date else None,
                "end_date": stage.end_date.isoformat() if stage.end_date else None,
                "weight": float(stage.weight),
                "exit_criteria": stage.exit_criteria,
                "weeks": week_payloads,
            }
        )
    return {
        "title": route.title,
        "description": route.description,
        "start_date": route.start_date.isoformat(),
        "end_date": route.end_date.isoformat(),
        "daily_capacity_minutes": route.daily_capacity_minutes,
        "stages": stage_payloads,
    }


def _create_version(
    db: Session,
    route: Route,
    user: User,
    *,
    change_type: str,
    change_summary: str,
) -> None:
    max_no = db.scalar(
        select(func.max(RouteVersion.version_no)).where(RouteVersion.route_id == route.id)
    ) or 0
    next_no = int(max_no) + 1
    route.current_version = next_no
    db.add(
        RouteVersion(
            route_id=route.id,
            version_no=next_no,
            snapshot_json=_snapshot(db, route),
            change_type=change_type,
            change_summary=change_summary,
            created_by=user.id,
        )
    )
    db.flush()


def route_detail(db: Session, route: Route) -> RouteDetail:
    stages = list(
        db.scalars(
            select(RouteStage)
            .where(RouteStage.route_id == route.id)
            .order_by(RouteStage.order_no)
        )
    )
    stage_payloads = []
    total_tasks = 0
    for stage in stages:
        weeks = list(
            db.scalars(
                select(RouteWeek)
                .where(RouteWeek.stage_id == stage.id)
                .order_by(RouteWeek.week_no)
            )
        )
        week_payloads = []
        for week in weeks:
            tasks = list(
                db.scalars(
                    select(Task)
                    .where(
                        Task.week_id == week.id,
                        Task.deleted_at.is_(None),
                        Task.status == "active",
                    )
                    .order_by(Task.planned_date, Task.created_at)
                )
            )
            total_tasks += len(tasks)
            week_payloads.append(
                {
                    "id": week.id,
                    "week_no": week.week_no,
                    "focus": week.focus,
                    "milestone": week.milestone,
                    "start_date": week.start_date,
                    "end_date": week.end_date,
                    "tasks": [TaskOut.model_validate(task) for task in tasks],
                }
            )
        stage_payloads.append(
            {
                "id": stage.id,
                "name": stage.name,
                "objective": stage.objective,
                "order_no": stage.order_no,
                "start_date": stage.start_date,
                "end_date": stage.end_date,
                "weight": float(stage.weight),
                "exit_criteria": stage.exit_criteria,
                "weeks": week_payloads,
            }
        )
    return RouteDetail.model_validate(
        {
            "id": route.id,
            "job_target_id": route.job_target_id,
            "title": route.title,
            "description": route.description,
            "status": route.status,
            "source_type": route.source_type,
            "start_date": route.start_date,
            "end_date": route.end_date,
            "forecast_end_date": route.forecast_end_date,
            "daily_capacity_minutes": route.daily_capacity_minutes,
            "current_version": route.current_version,
            "progress": {
                "total_tasks": total_tasks,
                "completed_tasks": 0,
                "percent": 0.0,
            },
            "stages": stage_payloads,
        }
    )


def create_route(db: Session, user: User, payload: RouteCreate) -> RouteDetail:
    if payload.job_target_id:
        target = job_target_service.get_job_target(db, user, payload.job_target_id)
    else:
        target = job_target_service.resolve_default(db, user)
    start = payload.start_date
    end = payload.end_date or (start + timedelta(days=30))
    if end < start:
        raise AppError("INVALID_ROUTE_DATES", "结束日期不能早于开始日期", status_code=422)
    route = Route(
        user_id=user.id,
        job_target_id=target.id,
        title=payload.title,
        description=payload.description,
        status="draft",
        source_type="manual",
        start_date=start,
        end_date=end,
        daily_capacity_minutes=payload.daily_capacity_minutes or _capacity(db, user),
        forecast_end_date=end,
        current_version=1,
    )
    db.add(route)
    db.flush()
    _create_version(db, route, user, change_type="create", change_summary="手动创建路线")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def update_route(db: Session, user: User, route_id: str, payload: RouteUpdate) -> RouteDetail:
    route = get_route(db, user, route_id)
    data = payload.model_dump(exclude_unset=True)
    start = data.get("start_date", route.start_date)
    end = data.get("end_date", route.end_date)
    if end < start:
        raise AppError("INVALID_ROUTE_DATES", "结束日期不能早于开始日期", status_code=422)
    for field in ("title", "description", "start_date", "end_date", "daily_capacity_minutes"):
        if field in data and data[field] is not None:
            setattr(route, field, data[field])
    if "start_date" in data or "end_date" in data:
        route.forecast_end_date = route.end_date
    db.flush()
    _create_version(db, route, user, change_type="manual_edit", change_summary="编辑路线")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def adjust_route(db: Session, user: User, route_id: str, payload: RouteAdjust) -> RouteDetail:
    route = get_route(db, user, route_id)
    new_start = payload.start_date or route.start_date
    delta = (new_start - route.start_date).days
    if delta:
        route.start_date = new_start
        route.end_date = route.end_date + timedelta(days=delta)
        if route.forecast_end_date:
            route.forecast_end_date = route.forecast_end_date + timedelta(days=delta)
        for stage in db.scalars(select(RouteStage).where(RouteStage.route_id == route.id)):
            if stage.start_date:
                stage.start_date = stage.start_date + timedelta(days=delta)
            if stage.end_date:
                stage.end_date = stage.end_date + timedelta(days=delta)
            for week in db.scalars(select(RouteWeek).where(RouteWeek.stage_id == stage.id)):
                if week.start_date:
                    week.start_date = week.start_date + timedelta(days=delta)
                if week.end_date:
                    week.end_date = week.end_date + timedelta(days=delta)
        for task in db.scalars(select(Task).where(Task.route_id == route.id)):
            if task.planned_date:
                task.planned_date = task.planned_date + timedelta(days=delta)
    if payload.daily_capacity_minutes is not None:
        route.daily_capacity_minutes = payload.daily_capacity_minutes
    db.flush()
    _create_version(db, route, user, change_type="adjust", change_summary="调整路线日期或容量")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def activate_route(db: Session, user: User, route_id: str) -> RouteDetail:
    route = get_route(db, user, route_id)
    if route.status not in {"draft", "paused"}:
        raise AppError("ROUTE_INVALID_STATE", "当前路线状态不能激活", status_code=409)
    db.execute(
        update(Route)
        .where(
            Route.user_id == user.id,
            Route.job_target_id == route.job_target_id,
            Route.id != route.id,
            Route.status == "active",
        )
        .values(status="paused")
    )
    route.status = "active"
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def pause_route(db: Session, user: User, route_id: str) -> RouteDetail:
    route = get_route(db, user, route_id)
    if route.status != "active":
        raise AppError("ROUTE_INVALID_STATE", "只有执行中的路线可以暂停", status_code=409)
    route.status = "paused"
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def resume_route(db: Session, user: User, route_id: str) -> RouteDetail:
    route = get_route(db, user, route_id)
    if route.status != "paused":
        raise AppError("ROUTE_INVALID_STATE", "只有暂停中的路线可以恢复", status_code=409)
    db.execute(
        update(Route)
        .where(
            Route.user_id == user.id,
            Route.job_target_id == route.job_target_id,
            Route.id != route.id,
            Route.status == "active",
        )
        .values(status="paused")
    )
    route.status = "active"
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def archive_route(db: Session, user: User, route_id: str) -> RouteDetail:
    route = get_route(db, user, route_id)
    route.status = "archived"
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def list_versions(db: Session, user: User, route_id: str) -> list[RouteVersion]:
    route = get_route(db, user, route_id)
    return list(
        db.scalars(
            select(RouteVersion)
            .where(RouteVersion.route_id == route.id)
            .order_by(RouteVersion.version_no.desc())
        )
    )


def get_version(
    db: Session, user: User, route_id: str, version_no: int
) -> RouteVersion:
    route = get_route(db, user, route_id)
    version = db.scalar(
        select(RouteVersion).where(
            RouteVersion.route_id == route.id,
            RouteVersion.version_no == version_no,
        )
    )
    if version is None:
        raise AppError("ROUTE_VERSION_NOT_FOUND", "路线版本不存在", status_code=404)
    return version


def create_stage(
    db: Session, user: User, route_id: str, payload: StageCreate
) -> RouteDetail:
    route = get_route(db, user, route_id)
    order_no = payload.order_no
    if order_no is None:
        max_order = db.scalar(
            select(func.max(RouteStage.order_no)).where(RouteStage.route_id == route.id)
        ) or 0
        order_no = int(max_order) + 1
    existing = db.scalar(
        select(RouteStage).where(
            RouteStage.route_id == route.id,
            RouteStage.order_no == order_no,
        )
    )
    if existing is not None:
        raise AppError("STAGE_ORDER_CONFLICT", "阶段顺序已存在", status_code=409)
    stage = RouteStage(
        route_id=route.id,
        name=payload.name,
        objective=payload.objective,
        order_no=order_no,
        start_date=payload.start_date,
        end_date=payload.end_date,
        weight=Decimal(str(payload.weight)),
        exit_criteria=payload.exit_criteria,
    )
    db.add(stage)
    db.flush()
    _create_version(db, route, user, change_type="manual_edit", change_summary="新增阶段")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def update_stage(
    db: Session, user: User, route_id: str, stage_id: str, payload: StageUpdate
) -> RouteDetail:
    route = get_route(db, user, route_id)
    stage = get_stage(db, route, stage_id)
    data = payload.model_dump(exclude_unset=True)
    if "order_no" in data and data["order_no"] is not None:
        conflict = db.scalar(
            select(RouteStage).where(
                RouteStage.route_id == route.id,
                RouteStage.order_no == data["order_no"],
                RouteStage.id != stage.id,
            )
        )
        if conflict is not None:
            raise AppError("STAGE_ORDER_CONFLICT", "阶段顺序已存在", status_code=409)
    for field, value in data.items():
        if value is not None or field in {"objective", "exit_criteria", "start_date", "end_date"}:
            setattr(stage, field, value)
    db.flush()
    _create_version(db, route, user, change_type="manual_edit", change_summary="编辑阶段")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def delete_stage(db: Session, user: User, route_id: str, stage_id: str) -> RouteDetail:
    route = get_route(db, user, route_id)
    stage = get_stage(db, route, stage_id)
    task_count = db.scalar(select(func.count(Task.id)).where(Task.stage_id == stage.id))
    if task_count:
        raise AppError("STAGE_HAS_TASKS", "阶段下还有任务，不能删除", status_code=409)
    db.execute(delete(RouteStage).where(RouteStage.id == stage.id))
    _create_version(db, route, user, change_type="manual_edit", change_summary="删除阶段")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def create_week(
    db: Session, user: User, stage_id: str, payload: WeekCreate
) -> RouteDetail:
    stage = db.scalar(select(RouteStage).where(RouteStage.id == stage_id))
    if stage is None:
        raise AppError("STAGE_NOT_FOUND", "阶段不存在", status_code=404)
    route = get_route(db, user, stage.route_id)
    week_no = payload.week_no
    if week_no is None:
        max_no = db.scalar(
            select(func.max(RouteWeek.week_no)).where(RouteWeek.stage_id == stage.id)
        ) or 0
        week_no = int(max_no) + 1
    existing = db.scalar(
        select(RouteWeek).where(
            RouteWeek.stage_id == stage.id,
            RouteWeek.week_no == week_no,
        )
    )
    if existing is not None:
        raise AppError("WEEK_NO_CONFLICT", "周序号已存在", status_code=409)
    week = RouteWeek(
        stage_id=stage.id,
        week_no=week_no,
        focus=payload.focus,
        milestone=payload.milestone,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(week)
    db.flush()
    _create_version(db, route, user, change_type="manual_edit", change_summary="新增周计划")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def update_week(
    db: Session, user: User, stage_id: str, week_id: str, payload: WeekUpdate
) -> RouteDetail:
    stage = db.scalar(select(RouteStage).where(RouteStage.id == stage_id))
    if stage is None:
        raise AppError("STAGE_NOT_FOUND", "阶段不存在", status_code=404)
    route = get_route(db, user, stage.route_id)
    week = get_week(db, stage, week_id)
    data = payload.model_dump(exclude_unset=True)
    if "week_no" in data and data["week_no"] is not None:
        conflict = db.scalar(
            select(RouteWeek).where(
                RouteWeek.stage_id == stage.id,
                RouteWeek.week_no == data["week_no"],
                RouteWeek.id != week.id,
            )
        )
        if conflict is not None:
            raise AppError("WEEK_NO_CONFLICT", "周序号已存在", status_code=409)
    for field, value in data.items():
        if value is not None or field in {"focus", "milestone", "start_date", "end_date"}:
            setattr(week, field, value)
    db.flush()
    _create_version(db, route, user, change_type="manual_edit", change_summary="编辑周计划")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)


def delete_week(db: Session, user: User, stage_id: str, week_id: str) -> RouteDetail:
    stage = db.scalar(select(RouteStage).where(RouteStage.id == stage_id))
    if stage is None:
        raise AppError("STAGE_NOT_FOUND", "阶段不存在", status_code=404)
    route = get_route(db, user, stage.route_id)
    week = get_week(db, stage, week_id)
    task_count = db.scalar(select(func.count(Task.id)).where(Task.week_id == week.id))
    if task_count:
        raise AppError("WEEK_HAS_TASKS", "周计划下还有任务，不能删除", status_code=409)
    db.execute(delete(RouteWeek).where(RouteWeek.id == week.id))
    _create_version(db, route, user, change_type="manual_edit", change_summary="删除周计划")
    db.commit()
    db.refresh(route)
    return route_detail(db, route)

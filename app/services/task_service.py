from __future__ import annotations

from datetime import date

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.route import Route, RouteStage, RouteWeek, Task
from app.models.user import User
from app.schemas.route import TaskCreate, TaskOut, TaskUpdate
from app.services.import_validation import ALLOWED_TASK_TYPES
from app.services.route_service import get_route


def get_task(db: Session, user: User, task_id: str) -> Task:
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.user_id == user.id,
            Task.deleted_at.is_(None),
        )
    )
    if task is None:
        raise AppError("TASK_NOT_FOUND", "任务不存在", status_code=404)
    return task


def _resolve_refs(
    db: Session,
    user: User,
    route_id: str | None,
    stage_id: str | None,
    week_id: str | None,
) -> tuple[Route | None, RouteStage | None, RouteWeek | None]:
    if not any((route_id, stage_id, week_id)):
        return None, None, None

    if week_id:
        week = db.get(RouteWeek, week_id)
        if week is None:
            raise AppError("WEEK_NOT_FOUND", "周计划不存在", status_code=404)
        stage = db.get(RouteStage, week.stage_id)
        if stage is None:
            raise AppError("STAGE_NOT_FOUND", "阶段不存在", status_code=404)
        route = get_route(db, user, stage.route_id)
        if stage_id and stage_id != stage.id:
            raise AppError("TASK_REF_MISMATCH", "周计划不属于该阶段", status_code=422)
        if route_id and route_id != route.id:
            raise AppError("TASK_REF_MISMATCH", "阶段不属于该路线", status_code=422)
        return route, stage, week

    if stage_id:
        stage = db.get(RouteStage, stage_id)
        if stage is None:
            raise AppError("STAGE_NOT_FOUND", "阶段不存在", status_code=404)
        route = get_route(db, user, stage.route_id)
        if route_id and route_id != route.id:
            raise AppError("TASK_REF_MISMATCH", "阶段不属于该路线", status_code=422)
        raise AppError("TASK_WEEK_REQUIRED", "路线任务必须归属到周计划", status_code=422)

    if route_id:
        get_route(db, user, route_id)
        raise AppError("TASK_WEEK_REQUIRED", "路线任务必须归属到阶段和周计划", status_code=422)

    return None, None, None


def list_tasks(
    db: Session,
    user: User,
    *,
    route_id: str | None = None,
    planned_date: date | None = None,
    status: str | None = None,
) -> list[Task]:
    statement = select(Task).where(
        Task.user_id == user.id,
        Task.deleted_at.is_(None),
    )
    if route_id:
        statement = statement.where(Task.route_id == route_id)
    if planned_date:
        statement = statement.where(Task.planned_date == planned_date)
    if status:
        statement = statement.where(Task.status == status)
    statement = statement.order_by(Task.planned_date, Task.created_at)
    return list(db.scalars(statement))


def create_task(db: Session, user: User, payload: TaskCreate) -> TaskOut:
    route, stage, week = _resolve_refs(
        db, user, payload.route_id, payload.stage_id, payload.week_id
    )
    if payload.task_type not in ALLOWED_TASK_TYPES:
        raise AppError("INVALID_TASK_TYPE", "任务类型无效", status_code=422)
    if route and payload.planned_date:
        if payload.planned_date < route.start_date or payload.planned_date > route.end_date:
            raise AppError("TASK_DATE_OUT_OF_RANGE", "任务日期超出路线范围", status_code=422)

    task = Task(
        user_id=user.id,
        route_id=route.id if route else None,
        stage_id=stage.id if stage else None,
        week_id=week.id if week else None,
        title=payload.title,
        description=payload.description,
        learning_objective=payload.learning_objective,
        task_type=payload.task_type,
        priority=payload.priority,
        difficulty=payload.difficulty,
        estimated_minutes=payload.estimated_minutes,
        planned_date=payload.planned_date,
        due_date=payload.due_date,
        deliverable=payload.deliverable,
        acceptance_criteria=payload.acceptance_criteria,
        resources_json=payload.resources or [],
        capability_tags_json=payload.capability_tags or [],
        needs_review=False,
        is_splittable=payload.is_splittable,
        source_type="manual",
        status="active",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


def update_task(db: Session, user: User, task_id: str, payload: TaskUpdate) -> TaskOut:
    task = get_task(db, user, task_id)
    data = payload.model_dump(exclude_unset=True)

    ref_keys = {"route_id", "stage_id", "week_id"}
    if ref_keys & data.keys():
        route, stage, week = _resolve_refs(
            db,
            user,
            data.get("route_id"),
            data.get("stage_id"),
            data.get("week_id"),
        )
        task.route_id = route.id if route else None
        task.stage_id = stage.id if stage else None
        task.week_id = week.id if week else None
        for key in ref_keys:
            data.pop(key, None)

    if "task_type" in data and data["task_type"] not in ALLOWED_TASK_TYPES:
        raise AppError("INVALID_TASK_TYPE", "任务类型无效", status_code=422)

    if "resources" in data:
        task.resources_json = data.pop("resources") or []
    if "capability_tags" in data:
        task.capability_tags_json = data.pop("capability_tags") or []

    if "planned_date" in data and data["planned_date"] and task.route_id:
        route = db.get(Route, task.route_id)
        if route and (data["planned_date"] < route.start_date or data["planned_date"] > route.end_date):
            raise AppError("TASK_DATE_OUT_OF_RANGE", "任务日期超出路线范围", status_code=422)

    for field, value in data.items():
        if value is not None or field in {
            "description",
            "learning_objective",
            "planned_date",
            "due_date",
            "difficulty",
        }:
            setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


def archive_task(db: Session, user: User, task_id: str) -> None:
    task = get_task(db, user, task_id)
    occurrence_count = db.scalar(
        text("SELECT COUNT(*) FROM task_occurrences WHERE task_id = :task_id"),
        {"task_id": task.id},
    )
    if occurrence_count:
        raise AppError("TASK_HAS_OCCURRENCES", "任务已经进入执行记录，不能删除", status_code=409)
    task.status = "archived"
    db.commit()

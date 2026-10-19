from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.route import TaskCreate, TaskOut, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(
    user: CurrentUser,
    db: DbSession,
    route_id: Annotated[str | None, Query()] = None,
    planned_date: Annotated[date | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
) -> list[TaskOut]:
    tasks = task_service.list_tasks(
        db,
        user,
        route_id=route_id,
        planned_date=planned_date,
        status=status_filter,
    )
    return [TaskOut.model_validate(task) for task in tasks]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(user: CurrentUser, db: DbSession, payload: TaskCreate) -> TaskOut:
    return task_service.create_task(db, user, payload)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    user: CurrentUser, db: DbSession, task_id: str, payload: TaskUpdate
) -> TaskOut:
    return task_service.update_task(db, user, task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_task(user: CurrentUser, db: DbSession, task_id: str) -> Response:
    task_service.archive_task(db, user, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

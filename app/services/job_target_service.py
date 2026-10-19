from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.profile import JobTarget
from app.models.user import User
from app.schemas.job_target import JobTargetCreate, JobTargetUpdate


def list_job_targets(
    db: Session, user: User, *, include_archived: bool = False
) -> list[JobTarget]:
    statement = select(JobTarget).where(JobTarget.user_id == user.id)
    if not include_archived:
        statement = statement.where(JobTarget.status == "active")
    statement = statement.order_by(JobTarget.is_primary.desc(), JobTarget.created_at.desc())
    return list(db.scalars(statement))


def _clear_primary(db: Session, user_id: str, except_id: str | None = None) -> None:
    statement = (
        update(JobTarget)
        .where(JobTarget.user_id == user_id, JobTarget.is_primary.is_(True))
        .values(is_primary=False)
    )
    if except_id:
        statement = statement.where(JobTarget.id != except_id)
    db.execute(statement)


def create_job_target(db: Session, user: User, payload: JobTargetCreate) -> JobTarget:
    if payload.is_primary:
        _clear_primary(db, user.id)
    target = JobTarget(user_id=user.id, **payload.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def get_job_target(db: Session, user: User, target_id: str) -> JobTarget:
    target = db.scalar(
        select(JobTarget).where(
            JobTarget.id == target_id,
            JobTarget.user_id == user.id,
        )
    )
    if target is None:
        raise AppError("JOB_TARGET_NOT_FOUND", "目标岗位不存在", status_code=404)
    return target


def update_job_target(
    db: Session, user: User, target_id: str, payload: JobTargetUpdate
) -> JobTarget:
    target = get_job_target(db, user, target_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_primary") is True:
        _clear_primary(db, user.id, except_id=target.id)
    if data.get("status") == "archived":
        data["is_primary"] = False
    for field, value in data.items():
        setattr(target, field, value)
    db.commit()
    db.refresh(target)
    return target


def archive_job_target(db: Session, user: User, target_id: str) -> None:
    target = get_job_target(db, user, target_id)
    target.status = "archived"
    target.is_primary = False
    db.commit()


def resolve_default(db: Session, user: User) -> JobTarget:
    target = db.scalar(
        select(JobTarget)
        .where(JobTarget.user_id == user.id, JobTarget.status == "active")
        .order_by(JobTarget.is_primary.desc(), JobTarget.created_at.asc())
    )
    if target is not None:
        return target
    target = JobTarget(
        user_id=user.id,
        title="我的目标岗位",
        is_primary=True,
        status="active",
    )
    db.add(target)
    db.flush()
    return target

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.system import Job
from app.models.user import User


def get_job(db: Session, user: User, job_id: str) -> Job:
    job = db.scalar(
        select(Job).where(
            Job.id == job_id,
            Job.user_id == user.id,
        )
    )
    if job is None:
        raise AppError("NOT_FOUND", "任务不存在", status_code=404)
    return job

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.job import JobOut
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobOut)
def get_job(user: CurrentUser, db: DbSession, job_id: str) -> JobOut:
    job = job_service.get_job(db, user, job_id)
    return JobOut(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        stage=job.stage,
        steps=job.steps_json,
        progress=float(job.progress),
        attempt=job.attempt,
        max_attempts=job.max_attempts,
        retryable=job.retryable,
        result_ref=job.result_ref,
        result_version=job.result_version,
        error=job.error_json,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )

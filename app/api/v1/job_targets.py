from __future__ import annotations

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.job_target import JobTargetCreate, JobTargetOut, JobTargetUpdate
from app.services import job_target_service

router = APIRouter(prefix="/job-targets", tags=["job-targets"])


@router.get("", response_model=list[JobTargetOut])
def list_job_targets(
    user: CurrentUser,
    db: DbSession,
    include_archived: bool = Query(default=False),
) -> list[JobTargetOut]:
    targets = job_target_service.list_job_targets(
        db, user, include_archived=include_archived
    )
    return [JobTargetOut.model_validate(target) for target in targets]


@router.post("", response_model=JobTargetOut, status_code=status.HTTP_201_CREATED)
def create_job_target(
    user: CurrentUser, db: DbSession, payload: JobTargetCreate
) -> JobTargetOut:
    target = job_target_service.create_job_target(db, user, payload)
    return JobTargetOut.model_validate(target)


@router.patch("/{target_id}", response_model=JobTargetOut)
def update_job_target(
    user: CurrentUser,
    db: DbSession,
    target_id: str,
    payload: JobTargetUpdate,
) -> JobTargetOut:
    target = job_target_service.update_job_target(db, user, target_id, payload)
    return JobTargetOut.model_validate(target)


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_job_target(user: CurrentUser, db: DbSession, target_id: str) -> Response:
    job_target_service.archive_job_target(db, user, target_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

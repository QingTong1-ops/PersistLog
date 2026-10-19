from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Request, Response, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import check_rate_limit
from app.models.system import StoredFile
from app.schemas.import_plan import (
    ImportConfirmResponse,
    ImportCreated,
    ImportDetail,
    ImportPreview,
    ImportSummary,
    PreviewUpdate,
)
from app.services import audit_service, import_service

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("", response_model=ImportCreated, status_code=status.HTTP_201_CREATED)
def create_import(
    user: CurrentUser,
    db: DbSession,
    request: Request,
    file: Annotated[UploadFile, File(...)],
) -> ImportCreated:
    check_rate_limit(f"import:{user.id}", 3, 3600)
    batch, job = import_service.create_import(db, user, file)
    return ImportCreated(import_id=batch.id, job_id=job.id, status=batch.status)


@router.get("", response_model=list[ImportSummary])
def list_imports(user: CurrentUser, db: DbSession) -> list[ImportSummary]:
    result: list[ImportSummary] = []
    for batch in import_service.list_imports(db, user):
        stored = db.get(StoredFile, batch.file_id)
        result.append(
            ImportSummary(
                import_id=batch.id,
                status=batch.status,
                format=batch.format,
                file_name=stored.original_name if stored else None,
                route_id=batch.created_route_id,
                created_at=batch.created_at,
            )
        )
    return result


@router.get("/{import_id}", response_model=ImportDetail)
def get_import(user: CurrentUser, db: DbSession, import_id: str) -> ImportDetail:
    return ImportDetail.model_validate(import_service.get_detail(db, user, import_id))


@router.get("/{import_id}/preview", response_model=ImportPreview)
def get_preview(user: CurrentUser, db: DbSession, import_id: str) -> ImportPreview:
    return ImportPreview.model_validate(import_service.get_preview(db, user, import_id))


@router.patch("/{import_id}/preview", response_model=ImportPreview)
def update_preview(
    user: CurrentUser,
    db: DbSession,
    import_id: str,
    payload: PreviewUpdate,
) -> ImportPreview:
    return ImportPreview.model_validate(
        import_service.update_preview(db, user, import_id, payload.route)
    )


@router.post("/{import_id}/confirm", response_model=ImportConfirmResponse)
def confirm_import(
    user: CurrentUser, db: DbSession, request: Request, import_id: str
) -> ImportConfirmResponse:
    route_id, created_tasks = import_service.confirm_import(db, user, import_id)
    audit_service.record(
        db,
        user,
        action="import.confirm",
        target_type="import_batch",
        target_id=import_id,
        after={"route_id": route_id, "created_tasks": created_tasks},
        request=request,
    )
    return ImportConfirmResponse(route_id=route_id, created_tasks=created_tasks)


@router.post("/{import_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
def cancel_import(user: CurrentUser, db: DbSession, import_id: str) -> Response:
    import_service.cancel_import(db, user, import_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{import_id}/rollback", status_code=status.HTTP_204_NO_CONTENT)
def rollback_import(user: CurrentUser, db: DbSession, import_id: str) -> Response:
    import_service.rollback_import(db, user, import_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

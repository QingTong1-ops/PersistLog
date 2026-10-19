from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.audit import AuditLogOut
from app.services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    user: CurrentUser,
    db: DbSession,
    action: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[AuditLogOut]:
    return [
        AuditLogOut(
            id=item.id,
            action=item.action,
            target_type=item.target_type,
            target_id=item.target_id,
            before=item.before_json,
            after=item.after_json,
            request_id=item.request_id,
            ip=item.ip,
            user_agent=item.user_agent,
            created_at=item.created_at,
        )
        for item in audit_service.list_logs(db, user, action=action, limit=limit)
    ]

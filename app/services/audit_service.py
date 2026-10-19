from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.system import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


def record(
    db: Session,
    user: User,
    *,
    action: str,
    target_type: str,
    target_id: str | None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog | None:
    try:
        log = AuditLog(
            user_id=user.id,
            actor_type="user",
            actor_id=user.id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            before_json=before,
            after_json=after,
            request_id=getattr(request.state, "request_id", None) if request else None,
            ip=request.client.host if request and request.client else None,
            user_agent=(request.headers.get("user-agent") or "")[:500] if request else None,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    except SQLAlchemyError:
        db.rollback()
        logger.exception("could not write audit log action=%s", action)
        return None


def list_logs(
    db: Session,
    user: User,
    *,
    action: str | None = None,
    limit: int = 50,
) -> list[AuditLog]:
    statement = select(AuditLog).where(AuditLog.user_id == user.id)
    if action:
        statement = statement.where(AuditLog.action == action)
    statement = statement.order_by(AuditLog.created_at.desc()).limit(min(limit, 200))
    return list(db.scalars(statement))

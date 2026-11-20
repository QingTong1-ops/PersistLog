from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.profile import UserConsent
from app.models.user import User
from app.schemas.consent import ConsentUpdate


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def list_consents(db: Session, user: User) -> list[UserConsent]:
    statement = (
        select(UserConsent)
        .where(UserConsent.user_id == user.id)
        .order_by(UserConsent.scope, UserConsent.version)
    )
    return list(db.scalars(statement))


CONSENT_MESSAGES = {
    "ai_import": "首次导入前请先同意 AI 解析授权",
    "ai_code_review": "提交代码评审前请先同意代码 AI 授权",
    "ai_route_generation": "生成路线前请先同意路线 AI 授权",
    "ai_quiz_feedback": "获取回答反馈前请先同意回答 AI 授权",
}


def require_consent(db: Session, user: User, scope: str) -> UserConsent:
    """Ensure the user has an active consent for a specific AI purpose."""
    consent = db.scalar(
        select(UserConsent)
        .where(
            UserConsent.user_id == user.id,
            UserConsent.scope == scope,
            UserConsent.revoked_at.is_(None),
        )
        .order_by(UserConsent.granted_at.desc())
    )
    if consent is None:
        raise AppError(
            "AI_CONSENT_REQUIRED",
            CONSENT_MESSAGES.get(scope, "请先同意该 AI 用途的授权"),
            status_code=403,
            details={"scope": scope},
        )
    return consent


def require_ai_import_consent(db: Session, user: User) -> UserConsent:
    """Backward-compatible wrapper for the import pipeline."""
    return require_consent(db, user, "ai_import")


def set_consent(
    db: Session,
    user: User,
    payload: ConsentUpdate,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> UserConsent:
    consent = db.scalar(
        select(UserConsent).where(
            UserConsent.user_id == user.id,
            UserConsent.scope == payload.scope,
            UserConsent.version == payload.version,
        )
    )
    now = _naive_utcnow()
    if consent is None:
        consent = UserConsent(
            user_id=user.id,
            scope=payload.scope,
            version=payload.version,
            granted_at=now,
            revoked_at=None if payload.granted else now,
            ip=ip,
            user_agent=user_agent,
        )
        db.add(consent)
    else:
        if payload.granted:
            consent.revoked_at = None
            consent.granted_at = now
        else:
            consent.revoked_at = now
    db.commit()
    db.refresh(consent)
    return consent

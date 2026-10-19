from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

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

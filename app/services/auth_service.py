from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models.profile import UserProfile
from app.models.user import RefreshToken, User

settings = get_settings()


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.get(User, user_id)


def register_user(
    db: Session,
    *,
    email: str,
    password: str,
    display_name: str = "",
    timezone_name: str = "Asia/Shanghai",
) -> User:
    normalized_email = email.strip().lower()
    existing = db.scalar(select(User).where(User.email == normalized_email))
    if existing is not None:
        raise AppError("EMAIL_ALREADY_EXISTS", "邮箱已注册", status_code=409)

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        display_name=display_name.strip(),
        timezone=timezone_name,
        status="active",
    )
    user.profile = UserProfile()
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppError("EMAIL_ALREADY_EXISTS", "邮箱已注册", status_code=409) from exc
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(
        select(User).where(
            User.email == normalized_email,
            User.status == "active",
            User.deleted_at.is_(None),
        )
    )
    if user is None or not verify_password(password, user.password_hash):
        raise AppError("INVALID_CREDENTIALS", "邮箱或密码错误", status_code=401)
    user.last_login_at = _naive_utcnow()
    db.commit()
    db.refresh(user)
    return user


def issue_token_pair(db: Session, user: User) -> tuple[str, str, int]:
    access_token = create_access_token(user.id)
    raw_refresh, refresh_hash, expires_at = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
        )
    )
    db.commit()
    return access_token, raw_refresh, settings.access_token_minutes * 60


def rotate_refresh_token(db: Session, raw_refresh_token: str) -> tuple[str, str, int, User]:
    token_hash = hash_refresh_token(raw_refresh_token)
    now = _naive_utcnow()
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    if stored is None or stored.expires_at <= now:
        raise AppError("INVALID_REFRESH_TOKEN", "刷新令牌无效或已过期", status_code=401)

    user = db.get(User, stored.user_id)
    if user is None or user.status != "active" or user.deleted_at is not None:
        raise AppError("INVALID_REFRESH_TOKEN", "刷新令牌无效或已过期", status_code=401)

    stored.revoked_at = now
    access_token = create_access_token(user.id)
    raw_refresh, refresh_hash, expires_at = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
            rotated_from=stored.id,
        )
    )
    db.commit()
    return access_token, raw_refresh, settings.access_token_minutes * 60, user


def revoke_refresh_token(db: Session, raw_refresh_token: str) -> None:
    token_hash = hash_refresh_token(raw_refresh_token)
    stored = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    if stored is None:
        return
    stored.revoked_at = _naive_utcnow()
    db.commit()

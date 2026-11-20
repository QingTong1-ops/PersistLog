from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.system import IdempotencyRecord

PROCESSING_TTL = timedelta(minutes=5)
RECORD_TTL = timedelta(hours=24)
MAX_KEY_LENGTH = 128


@dataclass(frozen=True)
class IdempotencyReplay:
    status_code: int
    body: Any


@dataclass(frozen=True)
class IdempotencyStart:
    """Reservation returned before an endpoint runs, or a replay result."""

    record_id: str | None
    replay: IdempotencyReplay | None


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def hash_request(
    method: str,
    path: str,
    query_string: bytes,
    body: bytes,
) -> str:
    digest = hashlib.sha256()
    digest.update(method.upper().encode("utf-8"))
    digest.update(b"\n")
    digest.update(path.encode("utf-8"))
    digest.update(b"\n")
    digest.update(query_string)
    digest.update(b"\n")
    digest.update(body)
    return digest.hexdigest()


def validate_key(key: str) -> str:
    key = key.strip()
    if not key or len(key) > MAX_KEY_LENGTH:
        raise AppError(
            "INVALID_IDEMPOTENCY_KEY",
            "Idempotency-Key 必须为 1–128 个字符",
            status_code=400,
        )
    return key


def begin(
    db: Session,
    *,
    user_id: str,
    key: str,
    method: str,
    path: str,
    request_hash: str,
) -> IdempotencyStart:
    """Reserve an idempotency key, or return a completed response to replay.

    The unique key guarantees that concurrent requests cannot both reserve the
    same scope. A second request receives 409 while the first is processing.
    """

    now = _naive_utcnow()
    existing = db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.idempotency_key == key,
            IdempotencyRecord.method == method.upper(),
            IdempotencyRecord.path == path,
        )
    )
    if existing is not None:
        return _resume(db, existing, request_hash, now)

    record = IdempotencyRecord(
        user_id=user_id,
        idempotency_key=key,
        method=method.upper(),
        path=path,
        request_hash=request_hash,
        status_code=0,
        state="processing",
        locked_until=now + PROCESSING_TTL,
        expires_at=now + RECORD_TTL,
    )
    db.add(record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(IdempotencyRecord).where(
                IdempotencyRecord.user_id == user_id,
                IdempotencyRecord.idempotency_key == key,
                IdempotencyRecord.method == method.upper(),
                IdempotencyRecord.path == path,
            )
        )
        if existing is None:
            raise AppError(
                "IDEMPOTENCY_CONFLICT",
                "幂等键冲突，请重试",
                status_code=409,
                retryable=True,
            ) from None
        return _resume(db, existing, request_hash, now)

    db.refresh(record)
    return IdempotencyStart(record_id=record.id, replay=None)


def _resume(
    db: Session,
    record: IdempotencyRecord,
    request_hash: str,
    now: datetime,
) -> IdempotencyStart:
    if record.request_hash != request_hash:
        raise AppError(
            "IDEMPOTENCY_CONFLICT",
            "相同 Idempotency-Key 对应了不同请求",
            status_code=409,
            details={"idempotency_key": record.idempotency_key},
        )

    if record.state == "completed":
        if record.expires_at > now:
            return IdempotencyStart(
                record_id=None,
                replay=IdempotencyReplay(
                    status_code=record.status_code,
                    body=record.response_json,
                ),
            )
        # Expired completed record; remove it and let the caller reserve anew.
        db.delete(record)
        db.commit()
        raise _ExpiredRecord

    if record.state == "processing":
        if record.locked_until is not None and record.locked_until > now:
            raise AppError(
                "IDEMPOTENCY_IN_PROGRESS",
                "相同请求正在处理中，请稍后重试",
                status_code=409,
                retryable=True,
            )
        # Claim an expired processing reservation atomically.
        result = db.execute(
            update(IdempotencyRecord)
            .where(
                IdempotencyRecord.id == record.id,
                IdempotencyRecord.state == "processing",
                or_(
                    IdempotencyRecord.locked_until.is_(None),
                    IdempotencyRecord.locked_until < now,
                ),
            )
            .values(
                locked_until=now + PROCESSING_TTL,
                expires_at=now + RECORD_TTL,
            )
        )
        db.commit()
        if result.rowcount != 1:
            raise AppError(
                "IDEMPOTENCY_IN_PROGRESS",
                "相同请求正在处理中，请稍后重试",
                status_code=409,
                retryable=True,
            )
        return IdempotencyStart(record_id=record.id, replay=None)

    raise AppError(
        "IDEMPOTENCY_STATE_INVALID",
        "幂等记录状态异常",
        status_code=409,
    )


class _ExpiredRecord(Exception):
    """Internal signal: expired completed record was removed."""


def begin_or_create(
    db: Session,
    *,
    user_id: str,
    key: str,
    method: str,
    path: str,
    request_hash: str,
) -> IdempotencyStart:
    """Like begin(), but transparently recreates an expired completed record."""
    try:
        return begin(
            db,
            user_id=user_id,
            key=key,
            method=method,
            path=path,
            request_hash=request_hash,
        )
    except _ExpiredRecord:
        return begin(
            db,
            user_id=user_id,
            key=key,
            method=method,
            path=path,
            request_hash=request_hash,
        )


def complete(
    db: Session,
    record_id: str,
    *,
    status_code: int,
    body: Any,
) -> None:
    record = db.get(IdempotencyRecord, record_id)
    if record is None or record.state != "processing":
        return
    record.state = "completed"
    record.status_code = status_code
    record.response_json = body
    record.locked_until = None
    record.expires_at = _naive_utcnow() + RECORD_TTL
    db.commit()


def release(db: Session, record_id: str) -> None:
    """Remove a reservation after a non-cacheable or failed response."""
    db.execute(
        delete(IdempotencyRecord).where(
            IdempotencyRecord.id == record_id,
            IdempotencyRecord.state == "processing",
        )
    )
    db.commit()

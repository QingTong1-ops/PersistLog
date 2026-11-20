from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from app.core.errors import AppError
from app.models.system import IdempotencyRecord
from app.services import idempotency_service
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.api.test_auth import register


def test_in_progress_then_replay_and_conflict(client: TestClient, db: Session) -> None:
    body = register(client, email="idem-service@example.com")
    user_id = body["user"]["id"]
    request_hash = idempotency_service.hash_request(
        "POST",
        "/api/v1/demo",
        b"",
        b'{"a":1}',
    )

    start = idempotency_service.begin(
        db,
        user_id=user_id,
        key="service-key",
        method="POST",
        path="/api/v1/demo",
        request_hash=request_hash,
    )
    assert start.record_id is not None

    with pytest.raises(AppError) as in_progress:
        idempotency_service.begin(
            db,
            user_id=user_id,
            key="service-key",
            method="POST",
            path="/api/v1/demo",
            request_hash=request_hash,
        )
    assert in_progress.value.code == "IDEMPOTENCY_IN_PROGRESS"
    assert in_progress.value.retryable is True

    with pytest.raises(AppError) as mismatch:
        idempotency_service.begin(
            db,
            user_id=user_id,
            key="service-key",
            method="POST",
            path="/api/v1/demo",
            request_hash="different",
        )
    assert mismatch.value.code == "IDEMPOTENCY_CONFLICT"

    idempotency_service.complete(
        db,
        start.record_id,
        status_code=200,
        body={"ok": True},
    )
    replay = idempotency_service.begin_or_create(
        db,
        user_id=user_id,
        key="service-key",
        method="POST",
        path="/api/v1/demo",
        request_hash=request_hash,
    )
    assert replay.record_id is None
    assert replay.replay is not None
    assert replay.replay.status_code == 200
    assert replay.replay.body == {"ok": True}


def test_expired_processing_reservation_can_be_claimed(
    client: TestClient, db: Session
) -> None:
    body = register(client, email="idem-expired@example.com")
    user_id = body["user"]["id"]
    request_hash = "hash"
    start = idempotency_service.begin(
        db,
        user_id=user_id,
        key="expired-key",
        method="POST",
        path="/api/v1/demo",
        request_hash=request_hash,
    )
    assert start.record_id

    record = db.get(IdempotencyRecord, start.record_id)
    assert record is not None
    record.locked_until = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1)
    db.commit()

    claimed = idempotency_service.begin(
        db,
        user_id=user_id,
        key="expired-key",
        method="POST",
        path="/api/v1/demo",
        request_hash=request_hash,
    )
    assert claimed.record_id == start.record_id
    assert claimed.replay is None

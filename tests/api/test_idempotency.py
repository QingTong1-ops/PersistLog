from __future__ import annotations

from app.models.system import IdempotencyRecord
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from tests.api.test_auth import auth_header, register
from tests.api.test_notifications import VALID_WEBHOOK


def test_repeated_post_replays_success_response(client: TestClient) -> None:
    body = register(client, email="idem@example.com")
    token = body["access_token"]
    payload = {
        "title": "幂等任务",
        "task_type": "review",
        "priority": "P1",
        "estimated_minutes": 30,
    }
    headers = {
        **auth_header(token),
        "Idempotency-Key": "idem-test-1",
        "Origin": "http://localhost:3000",
    }

    first = client.post(
        "/api/v1/today/items?date=2099-01-02",
        headers=headers,
        json=payload,
    )
    assert first.status_code == 200, first.text
    second = client.post(
        "/api/v1/today/items?date=2099-01-02",
        headers=headers,
        json=payload,
    )
    assert second.status_code == 200, second.text
    assert second.headers["idempotency-replayed"] == "true"
    assert second.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert second.json() == first.json()

    today = client.get(
        "/api/v1/today?date=2099-01-02",
        headers=auth_header(token),
    )
    assert today.json()["summary"]["planned_tasks"] == 1


def test_same_key_with_different_body_conflicts(client: TestClient) -> None:
    body = register(client, email="idem-conflict@example.com")
    token = body["access_token"]
    headers = {**auth_header(token), "Idempotency-Key": "idem-test-2"}

    first = client.post(
        "/api/v1/today/items?date=2099-01-02",
        headers=headers,
        json={"title": "任务 A", "estimated_minutes": 30},
    )
    assert first.status_code == 200, first.text

    conflict = client.post(
        "/api/v1/today/items?date=2099-01-02",
        headers=headers,
        json={"title": "任务 B", "estimated_minutes": 30},
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert conflict.json()["error"]["retryable"] is False


def test_repeated_delete_replays_204(client: TestClient) -> None:
    body = register(client, email="idem-delete@example.com")
    token = body["access_token"]
    created = client.post(
        "/api/v1/notification-channels",
        headers=auth_header(token),
        json={"name": "幂等渠道", "webhook_url": VALID_WEBHOOK},
    )
    assert created.status_code == 201, created.text
    channel_id = created.json()["id"]
    headers = {**auth_header(token), "Idempotency-Key": "idem-delete-1"}

    first = client.delete(
        f"/api/v1/notification-channels/{channel_id}",
        headers=headers,
    )
    assert first.status_code == 204
    second = client.delete(
        f"/api/v1/notification-channels/{channel_id}",
        headers=headers,
    )
    assert second.status_code == 204
    assert second.headers["idempotency-replayed"] == "true"


def test_auth_endpoints_are_not_cached(
    client: TestClient, db: Session
) -> None:
    register(client, email="idem-auth@example.com")
    headers = {"Idempotency-Key": "idem-auth-1"}
    first = client.post(
        "/api/v1/auth/login",
        headers=headers,
        json={"email": "idem-auth@example.com", "password": "password123"},
    )
    second = client.post(
        "/api/v1/auth/login",
        headers=headers,
        json={"email": "idem-auth@example.com", "password": "password123"},
    )
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    assert "idempotency-replayed" not in second.headers
    assert db.scalar(select(func.count(IdempotencyRecord.id))) == 0


def test_invalid_idempotency_key_is_rejected(client: TestClient) -> None:
    body = register(client, email="idem-invalid@example.com")
    response = client.post(
        "/api/v1/today/items?date=2099-01-02",
        headers={
            **auth_header(body["access_token"]),
            "Idempotency-Key": "x" * 129,
        },
        json={"title": "任务", "estimated_minutes": 30},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_IDEMPOTENCY_KEY"

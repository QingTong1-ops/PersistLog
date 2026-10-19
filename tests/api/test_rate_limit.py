from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_imports import PLAN, _upload
from tests.api.test_notifications import VALID_WEBHOOK

PASSWORD = "password123"


def test_login_rate_limit(client: TestClient) -> None:
    register(client, email="login-limit@example.com")
    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "login-limit@example.com", "password": PASSWORD},
        )
        assert response.status_code == 200
    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "login-limit@example.com", "password": PASSWORD},
    )
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_import_rate_limit(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    for _ in range(3):
        response = _upload(client, token, PLAN)
        assert response.status_code == 201, response.text
    blocked = _upload(client, token, PLAN)
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_notification_test_rate_limit(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    channel = client.post(
        "/api/v1/notification-channels",
        headers=auth_header(token),
        json={"name": "限流渠道", "webhook_url": VALID_WEBHOOK},
    ).json()
    for _ in range(5):
        response = client.post(
            f"/api/v1/notification-channels/{channel['id']}/test",
            headers=auth_header(token),
        )
        assert response.status_code == 200, response.text
    blocked = client.post(
        f"/api/v1/notification-channels/{channel['id']}/test",
        headers=auth_header(token),
    )
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"

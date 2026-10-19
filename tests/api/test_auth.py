from __future__ import annotations

from fastapi.testclient import TestClient


def register(
    client: TestClient,
    *,
    email: str = "user@example.com",
    password: str = "password123",
) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "display_name": "测试用户",
            "timezone": "Asia/Shanghai",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth_header(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def test_register_login_refresh_logout(client: TestClient) -> None:
    body = register(client)
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "user@example.com"
    assert body["access_token"]
    assert body["refresh_token"]

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login.status_code == 200, login.text
    refresh_token = login.json()["refresh_token"]

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refreshed.status_code == 200, refreshed.text
    new_refresh = refreshed.json()["refresh_token"]
    assert new_refresh != refresh_token

    reused = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert reused.status_code == 401

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_refresh},
    )
    assert logout.status_code == 204

    after_logout = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh},
    )
    assert after_logout.status_code == 401


def test_duplicate_email(client: TestClient) -> None:
    register(client)
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_wrong_password(client: TestClient) -> None:
    register(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_returns_current_user(client: TestClient) -> None:
    body = register(client)
    response = client.get(
        "/api/v1/auth/me",
        headers=auth_header(body["access_token"]),
    )
    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_invalid_access_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"

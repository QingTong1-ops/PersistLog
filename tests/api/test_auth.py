from __future__ import annotations

from app.core.config import get_settings
from fastapi.testclient import TestClient

REFRESH_COOKIE = get_settings().refresh_cookie_name
REFRESH_PATH = get_settings().refresh_cookie_path


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
    assert "refresh_token" not in body

    set_cookie = client.cookies.get(REFRESH_COOKIE)
    assert set_cookie

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "password123"},
    )
    assert login.status_code == 200, login.text
    assert "refresh_token" not in login.json()
    old_refresh = client.cookies.get(REFRESH_COOKIE)
    assert old_refresh

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200, refreshed.text
    assert "refresh_token" not in refreshed.json()
    new_refresh = client.cookies.get(REFRESH_COOKIE)
    assert new_refresh and new_refresh != old_refresh

    # A rotated (revoked) token cannot be replayed, even through the body
    # fallback used by non-browser clients.
    client.cookies.clear()
    reused = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"

    # Reuse detection revokes the whole family, including the newest token.
    family = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": new_refresh},
    )
    assert family.status_code == 401

    logout = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": new_refresh},
    )
    assert logout.status_code == 204
    assert REFRESH_COOKIE in logout.headers.get("set-cookie", "")


def test_refresh_cookie_is_http_only_and_path_scoped(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "cookie@example.com",
            "password": "password123",
            "display_name": "Cookie",
            "timezone": "Asia/Shanghai",
        },
    )
    assert response.status_code == 201, response.text
    header = response.headers["set-cookie"]
    assert f"{REFRESH_COOKIE}=" in header
    assert "HttpOnly" in header
    assert f"Path={REFRESH_PATH}" in header
    assert "SameSite=lax" in header
    assert "Max-Age=" in header
    # The test environment runs over HTTP, so the cookie is not Secure there.
    assert "Secure" not in header


def test_refresh_rejects_untrusted_origin(client: TestClient) -> None:
    register(client)
    response = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_ORIGIN_REJECTED"

    allowed_origin = get_settings().cors_origin_list[0]
    allowed = client.post(
        "/api/v1/auth/refresh",
        headers={"Origin": allowed_origin},
    )
    assert allowed.status_code == 200, allowed.text
    assert allowed.headers.get("access-control-allow-origin") == allowed_origin


def test_invalid_refresh_clears_stale_cookie(client: TestClient) -> None:
    register(client)
    client.cookies.clear()
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-valid-token"},
    )
    assert response.status_code == 401
    assert "Max-Age=0" in response.headers.get("set-cookie", "")


def test_logout_clears_cookie(client: TestClient) -> None:
    register(client)
    assert client.cookies.get(REFRESH_COOKIE)

    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 204
    set_cookie = logout.headers.get("set-cookie", "")
    assert REFRESH_COOKIE in set_cookie
    assert "Max-Age=0" in set_cookie
    assert client.cookies.get(REFRESH_COOKIE) is None

    after_logout = client.post("/api/v1/auth/refresh")
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

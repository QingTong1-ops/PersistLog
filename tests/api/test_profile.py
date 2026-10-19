from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register


def test_profile_get_and_update(client: TestClient) -> None:
    body = register(client)
    headers = auth_header(body["access_token"])

    profile = client.get("/api/v1/profile", headers=headers)
    assert profile.status_code == 200, profile.text
    data = profile.json()
    assert data["daily_available_minutes"] == 120
    assert data["planning_capacity_factor"] == 0.8
    assert data["day_boundary_time"] == "04:00:00"
    assert data["user"]["email"] == "user@example.com"

    updated = client.put(
        "/api/v1/profile",
        headers=headers,
        json={
            "display_name": "新名字",
            "timezone": "UTC",
            "daily_available_minutes": 240,
            "planning_capacity_factor": 0.7,
            "day_boundary_hour": 3,
            "tech_stack": ["Python", "MySQL"],
            "bio": "后端",
        },
    )
    assert updated.status_code == 200, updated.text
    data = updated.json()
    assert data["user"]["display_name"] == "新名字"
    assert data["user"]["timezone"] == "UTC"
    assert data["daily_available_minutes"] == 240
    assert data["planning_capacity_factor"] == 0.7
    assert data["day_boundary_time"] == "03:00:00"
    assert data["tech_stack"] == ["Python", "MySQL"]

    settings = client.get("/api/v1/settings", headers=headers)
    assert settings.status_code == 200
    assert settings.json() == {
        "timezone": "UTC",
        "daily_available_minutes": 240,
        "planning_capacity_factor": 0.7,
        "day_boundary_hour": 3,
    }

    updated_settings = client.put(
        "/api/v1/settings",
        headers=headers,
        json={"daily_available_minutes": 180, "day_boundary_hour": 5},
    )
    assert updated_settings.status_code == 200
    assert updated_settings.json()["daily_available_minutes"] == 180
    assert updated_settings.json()["day_boundary_hour"] == 5


def test_profile_requires_token(client: TestClient) -> None:
    response = client.get("/api/v1/profile")
    assert response.status_code == 401


def test_invalid_timezone(client: TestClient) -> None:
    body = register(client)
    response = client.put(
        "/api/v1/profile",
        headers=auth_header(body["access_token"]),
        json={"timezone": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_TIMEZONE"

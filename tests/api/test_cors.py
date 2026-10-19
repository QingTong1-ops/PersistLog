from __future__ import annotations

from app.core.config import get_settings
from fastapi.testclient import TestClient


def test_preflight_allows_configured_origin(client: TestClient) -> None:
    origin = get_settings().cors_origin_list[0]
    response = client.options(
        "/api/v1/today",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "GET" in response.headers["access-control-allow-methods"]


def test_preflight_rejects_unknown_origin(client: TestClient) -> None:
    response = client.options(
        "/api/v1/today",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_simple_request_exposes_request_id(client: TestClient) -> None:
    origin = get_settings().cors_origin_list[0]
    response = client.get("/health", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["x-request-id"]

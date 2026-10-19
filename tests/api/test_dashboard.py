from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_planning import get_today, prepare_route


def test_overview_matches_today(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route, _ = prepare_route(client, token)
    today = get_today(client, token, "2099-01-02")
    occurrence = today["items"][0]

    client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/complete",
        headers=auth_header(token),
        json={"actual_minutes": 50},
    )

    overview = client.get(
        "/api/v1/dashboard/overview?date=2099-01-02&days=1",
        headers=auth_header(token),
    )
    assert overview.status_code == 200, overview.text
    data = overview.json()
    today = get_today(client, token, "2099-01-02")
    assert data["planned_tasks"] == today["summary"]["planned_tasks"]
    assert data["completed_tasks"] == today["summary"]["completed_tasks"]
    assert data["planned_minutes"] == today["summary"]["planned_minutes"]
    assert data["actual_minutes"] == today["summary"]["actual_minutes"]
    assert data["completion_rate"] == today["summary"]["completion_rate"]
    assert data["active_routes"] == 1
    assert data["route_progress"]["total_tasks"] == 1
    assert data["route_progress"]["completed_tasks"] == 1
    assert data["route_progress"]["percent"] == 100.0
    route_detail = client.get(
        f"/api/v1/routes/{route['id']}",
        headers=auth_header(token),
    )
    assert route_detail.status_code == 200
    assert route_detail.json()["progress"] == data["route_progress"]


def test_trends_and_distribution(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route, _ = prepare_route(client, token)
    occurrence = get_today(client, token, "2099-01-02")["items"][0]
    client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/complete",
        headers=auth_header(token),
        json={"actual_minutes": 50},
    )

    trends = client.get(
        "/api/v1/dashboard/trends?date=2099-01-03&days=2",
        headers=auth_header(token),
    )
    assert trends.status_code == 200, trends.text
    points = trends.json()["points"]
    assert len(points) == 2
    assert points[0]["date"] == "2099-01-02"
    assert points[0]["planned_tasks"] == 1
    assert points[0]["completed_tasks"] == 1
    assert points[1]["planned_tasks"] == 0
    assert points[1]["completion_rate"] == 0.0

    distribution = client.get(
        "/api/v1/dashboard/distribution?date=2099-01-02&days=1",
        headers=auth_header(token),
    )
    assert distribution.status_code == 200, distribution.text
    data = distribution.json()
    assert data["by_task_type"] == [
        {
            "key": "fundamentals",
            "label": "基础原理",
            "planned_tasks": 1,
            "completed_tasks": 1,
            "planned_minutes": 45,
            "actual_minutes": 50,
        }
    ]
    assert data["by_route"][0]["key"] == route["id"]
    assert data["by_status"][0]["key"] == "completed"
    assert data["by_priority"][0]["key"] == "P1"


def test_carry_over_rate(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    prepare_route(client, token)
    occurrence = get_today(client, token, "2099-01-02")["items"][0]
    client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/postpone",
        headers=auth_header(token),
    )
    get_today(client, token, "2099-01-03")

    overview = client.get(
        "/api/v1/dashboard/overview?date=2099-01-03&days=1",
        headers=auth_header(token),
    )
    assert overview.status_code == 200, overview.text
    data = overview.json()
    assert data["planned_tasks"] == 1
    assert data["carry_over_count"] == 1
    assert data["carry_over_rate"] == 1.0


def test_forecast_and_empty_dashboard(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route, _ = prepare_route(client, token)

    forecast = client.get(
        "/api/v1/dashboard/forecast",
        headers=auth_header(token),
    )
    assert forecast.status_code == 200, forecast.text
    data = forecast.json()
    assert data["remaining_minutes"] == 45
    assert data["throughput_minutes"] >= 30
    assert len(data["routes"]) == 1
    assert data["routes"][0]["route_id"] == route["id"]
    assert data["routes"][0]["title"] == "后端路线"

    empty = register(client, email="empty@example.com")
    empty_token = empty["access_token"]
    overview = client.get(
        "/api/v1/dashboard/overview?date=2099-01-02&days=7",
        headers=auth_header(empty_token),
    )
    assert overview.status_code == 200
    empty_data = overview.json()
    assert empty_data["planned_tasks"] == 0
    assert empty_data["completed_tasks"] == 0
    assert empty_data["completion_rate"] == 0.0
    assert empty_data["actual_minutes"] == 0
    assert empty_data["route_progress"] == {
        "total_tasks": 0,
        "completed_tasks": 0,
        "percent": 0.0,
    }

    trends = client.get(
        "/api/v1/dashboard/trends?date=2099-01-08&days=7",
        headers=auth_header(empty_token),
    )
    assert trends.status_code == 200
    assert len(trends.json()["points"]) == 7
    assert all(point["planned_tasks"] == 0 for point in trends.json()["points"])

    distribution = client.get(
        "/api/v1/dashboard/distribution?date=2099-01-02&days=7",
        headers=auth_header(empty_token),
    )
    assert distribution.status_code == 200
    assert distribution.json()["by_task_type"] == []
    assert distribution.json()["by_route"] == []


def test_dashboard_timezone_and_isolation(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    prepare_route(client, alice["access_token"])

    updated = client.put(
        "/api/v1/profile",
        headers=auth_header(bob["access_token"]),
        json={"timezone": "UTC"},
    )
    assert updated.status_code == 200, updated.text

    overview = client.get(
        "/api/v1/dashboard/overview?date=2099-01-02&days=1",
        headers=auth_header(bob["access_token"]),
    )
    assert overview.status_code == 200
    data = overview.json()
    assert data["timezone"] == "UTC"
    assert data["planned_tasks"] == 0

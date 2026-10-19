from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register


def create_route(
    client: TestClient,
    token: str,
    *,
    title: str = "后端路线",
) -> dict:
    response = client.post(
        "/api/v1/routes",
        headers=auth_header(token),
        json={
            "title": title,
            "start_date": "2099-01-01",
            "end_date": "2099-02-01",
            "daily_capacity_minutes": 120,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def add_stage(client: TestClient, token: str, route_id: str) -> dict:
    response = client.post(
        f"/api/v1/routes/{route_id}/stages",
        headers=auth_header(token),
        json={
            "name": "基础夯实",
            "objective": "补齐基础",
            "start_date": "2099-01-01",
            "end_date": "2099-01-15",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def add_week(client: TestClient, token: str, stage_id: str) -> dict:
    response = client.post(
        f"/api/v1/stages/{stage_id}/weeks",
        headers=auth_header(token),
        json={
            "week_no": 1,
            "focus": "网络基础",
            "milestone": "讲清 TCP",
            "start_date": "2099-01-01",
            "end_date": "2099-01-07",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def add_task(client: TestClient, token: str, route: dict) -> dict:
    stage = route["stages"][0]
    week = stage["weeks"][0]
    response = client.post(
        "/api/v1/tasks",
        headers=auth_header(token),
        json={
            "route_id": route["id"],
            "stage_id": stage["id"],
            "week_id": week["id"],
            "title": "TCP 三次握手",
            "task_type": "fundamentals",
            "priority": "P1",
            "estimated_minutes": 45,
            "planned_date": "2099-01-02",
            "deliverable": "口述录音",
            "acceptance_criteria": "讲清状态机",
            "resources": ["自顶向下"],
            "capability_tags": ["network.tcp"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_route_stage_week_task_flow(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]

    route = create_route(client, token)
    assert route["status"] == "draft"
    assert route["progress"]["total_tasks"] == 0
    assert route["stages"] == []

    route = add_stage(client, token, route["id"])
    assert len(route["stages"]) == 1
    stage_id = route["stages"][0]["id"]

    route = add_week(client, token, stage_id)
    assert len(route["stages"][0]["weeks"]) == 1
    week_id = route["stages"][0]["weeks"][0]["id"]

    task = add_task(client, token, route)
    assert task["resources"] == ["自顶向下"]
    assert task["capability_tags"] == ["network.tcp"]

    detail = client.get(f"/api/v1/routes/{route['id']}", headers=auth_header(token))
    assert detail.status_code == 200
    data = detail.json()
    assert data["progress"]["total_tasks"] == 1
    assert data["stages"][0]["weeks"][0]["tasks"][0]["title"] == "TCP 三次握手"

    listing = client.get("/api/v1/tasks", headers=auth_header(token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    updated = client.patch(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_header(token),
        json={"title": "TCP 三次握手（改）", "estimated_minutes": 60},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "TCP 三次握手（改）"

    archived = client.delete(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_header(token),
    )
    assert archived.status_code == 204

    detail = client.get(f"/api/v1/routes/{route['id']}", headers=auth_header(token))
    assert detail.json()["progress"]["total_tasks"] == 0

    delete_stage = client.delete(
        f"/api/v1/routes/{route['id']}/stages/{stage_id}",
        headers=auth_header(token),
    )
    # The archived task still references the stage; deletion remains protected.
    assert delete_stage.status_code == 409
    assert delete_stage.json()["error"]["code"] == "STAGE_HAS_TASKS"

    delete_week = client.delete(
        f"/api/v1/stages/{stage_id}/weeks/{week_id}",
        headers=auth_header(token),
    )
    assert delete_week.status_code == 409
    assert delete_week.json()["error"]["code"] == "WEEK_HAS_TASKS"


def test_route_status_transitions(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    first = create_route(client, token, title="路线 A")
    second = create_route(client, token, title="路线 B")

    activated = client.post(
        f"/api/v1/routes/{first['id']}/activate",
        headers=auth_header(token),
    )
    assert activated.status_code == 200
    assert activated.json()["status"] == "active"

    second_active = client.post(
        f"/api/v1/routes/{second['id']}/activate",
        headers=auth_header(token),
    )
    assert second_active.status_code == 200
    assert second_active.json()["status"] == "active"

    first_after = client.get(
        f"/api/v1/routes/{first['id']}", headers=auth_header(token)
    )
    assert first_after.json()["status"] == "paused"

    paused = client.post(
        f"/api/v1/routes/{second['id']}/pause",
        headers=auth_header(token),
    )
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"

    resumed = client.post(
        f"/api/v1/routes/{second['id']}/resume",
        headers=auth_header(token),
    )
    assert resumed.status_code == 200
    assert resumed.json()["status"] == "active"

    archived = client.post(
        f"/api/v1/routes/{second['id']}/archive",
        headers=auth_header(token),
    )
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"


def test_route_adjust_shifts_tasks_and_versions(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route = create_route(client, token)
    route = add_stage(client, token, route["id"])
    stage_id = route["stages"][0]["id"]
    route = add_week(client, token, stage_id)
    task = add_task(client, token, route)

    updated = client.patch(
        f"/api/v1/routes/{route['id']}",
        headers=auth_header(token),
        json={"title": "后端路线 v2"},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "后端路线 v2"

    adjusted = client.post(
        f"/api/v1/routes/{route['id']}/adjust",
        headers=auth_header(token),
        json={"start_date": "2099-01-05", "daily_capacity_minutes": 180},
    )
    assert adjusted.status_code == 200, adjusted.text
    data = adjusted.json()
    assert data["start_date"] == "2099-01-05"
    assert data["daily_capacity_minutes"] == 180
    assert data["stages"][0]["weeks"][0]["tasks"][0]["planned_date"] == "2099-01-06"

    versions = client.get(
        f"/api/v1/routes/{route['id']}/versions",
        headers=auth_header(token),
    )
    assert versions.status_code == 200
    assert len(versions.json()) >= 4

    latest_no = versions.json()[0]["version_no"]
    latest = client.get(
        f"/api/v1/routes/{route['id']}/versions/{latest_no}",
        headers=auth_header(token),
    )
    assert latest.status_code == 200
    snapshot = latest.json()["snapshot"]
    assert snapshot["title"] == "后端路线 v2"
    assert snapshot["start_date"] == "2099-01-05"
    assert (
        snapshot["stages"][0]["weeks"][0]["tasks"][0]["planned_date"] == "2099-01-06"
    )

    first_version = client.get(
        f"/api/v1/routes/{route['id']}/versions/1",
        headers=auth_header(token),
    )
    assert first_version.status_code == 200
    assert first_version.json()["snapshot"]["stages"] == []

    task_detail = client.get(
        f"/api/v1/tasks?route_id={route['id']}&planned_date=2099-01-06",
        headers=auth_header(token),
    )
    assert task_detail.status_code == 200
    assert len(task_detail.json()) == 1
    assert task_detail.json()[0]["id"] == task["id"]


def test_route_user_isolation(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    route = create_route(client, alice["access_token"])

    response = client.get(
        f"/api/v1/routes/{route['id']}",
        headers=auth_header(bob["access_token"]),
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ROUTE_NOT_FOUND"

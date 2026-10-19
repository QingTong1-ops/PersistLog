from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_routes import add_stage, add_task, add_week, create_route


def test_route_list_and_status_filter(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route = create_route(client, token)

    listing = client.get("/api/v1/routes", headers=auth_header(token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    active = client.get("/api/v1/routes?status=active", headers=auth_header(token))
    assert active.status_code == 200
    assert active.json() == []

    client.post(f"/api/v1/routes/{route['id']}/activate", headers=auth_header(token))
    active = client.get("/api/v1/routes?status=active", headers=auth_header(token))
    assert len(active.json()) == 1
    assert active.json()[0]["id"] == route["id"]


def test_route_task_requires_week(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route = create_route(client, token)
    response = client.post(
        "/api/v1/tasks",
        headers=auth_header(token),
        json={
            "route_id": route["id"],
            "title": "没有周的任务",
            "task_type": "fundamentals",
            "estimated_minutes": 45,
            "deliverable": "笔记",
            "acceptance_criteria": "讲清",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "TASK_WEEK_REQUIRED"


def test_task_week_only_derives_route_and_stage(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route = create_route(client, token)
    route = add_stage(client, token, route["id"])
    stage_id = route["stages"][0]["id"]
    route = add_week(client, token, stage_id)
    week_id = route["stages"][0]["weeks"][0]["id"]

    response = client.post(
        "/api/v1/tasks",
        headers=auth_header(token),
        json={
            "week_id": week_id,
            "title": "只给周的任务",
            "task_type": "fundamentals",
            "estimated_minutes": 45,
            "deliverable": "笔记",
            "acceptance_criteria": "讲清",
        },
    )
    assert response.status_code == 201, response.text
    task = response.json()
    assert task["status"] == "active"
    assert task["source_type"] == "manual"

    detail = client.get(f"/api/v1/routes/{route['id']}", headers=auth_header(token))
    assert detail.json()["progress"]["total_tasks"] == 1


def test_task_date_out_of_route(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route = create_route(client, token)
    route = add_stage(client, token, route["id"])
    stage_id = route["stages"][0]["id"]
    route = add_week(client, token, stage_id)
    week = route["stages"][0]["weeks"][0]

    response = client.post(
        "/api/v1/tasks",
        headers=auth_header(token),
        json={
            "route_id": route["id"],
            "stage_id": stage_id,
            "week_id": week["id"],
            "title": "越界任务",
            "task_type": "fundamentals",
            "estimated_minutes": 45,
            "planned_date": "2099-03-01",
            "deliverable": "笔记",
            "acceptance_criteria": "讲清",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "TASK_DATE_OUT_OF_RANGE"


def test_task_user_isolation(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    route = create_route(client, alice["access_token"])
    route = add_stage(client, alice["access_token"], route["id"])
    stage_id = route["stages"][0]["id"]
    route = add_week(client, alice["access_token"], stage_id)
    task = add_task(client, alice["access_token"], route)

    bob_list = client.get("/api/v1/tasks", headers=auth_header(bob["access_token"]))
    assert bob_list.status_code == 200
    assert bob_list.json() == []

    bob_archive = client.delete(
        f"/api/v1/tasks/{task['id']}",
        headers=auth_header(bob["access_token"]),
    )
    assert bob_archive.status_code == 404
    assert bob_archive.json()["error"]["code"] == "TASK_NOT_FOUND"

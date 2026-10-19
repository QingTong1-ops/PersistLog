from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_routes import add_stage, add_task, add_week, create_route


def prepare_route(client: TestClient, token: str) -> tuple[dict, dict]:
    route = create_route(client, token)
    client.post(f"/api/v1/routes/{route['id']}/activate", headers=auth_header(token))
    route = add_stage(client, token, route["id"])
    stage_id = route["stages"][0]["id"]
    route = add_week(client, token, stage_id)
    task = add_task(client, token, route)
    return route, task


def get_today(client: TestClient, token: str, date: str) -> dict:
    response = client.get(
        f"/api/v1/today?date={date}",
        headers=auth_header(token),
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_today_generate_and_complete(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route, task = prepare_route(client, token)

    today = get_today(client, token, "2099-01-02")
    assert today["summary"]["planned_tasks"] == 1
    assert len(today["items"]) == 1
    occurrence = today["items"][0]
    assert occurrence["task_id"] == task["id"]
    assert occurrence["why"]

    generated = client.post(
        "/api/v1/today/generate?date=2099-01-02",
        headers=auth_header(token),
    )
    assert generated.status_code == 200
    assert generated.json()["plan_id"] == today["plan_id"]

    completed = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/complete",
        headers=auth_header(token),
        json={"actual_minutes": 50, "note": "完成"},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert completed.json()["actual_minutes"] == 50

    detail = client.get(f"/api/v1/routes/{route['id']}", headers=auth_header(token))
    assert detail.status_code == 200
    progress = detail.json()["progress"]
    assert progress["total_tasks"] == 1
    assert progress["completed_tasks"] == 1
    assert progress["percent"] == 100.0

    today = get_today(client, token, "2099-01-02")
    assert today["summary"]["completed_tasks"] == 1
    assert today["summary"]["actual_minutes"] == 50


def test_postpone_and_carry_over(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    prepare_route(client, token)

    today = get_today(client, token, "2099-01-02")
    occurrence = today["items"][0]
    postponed = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/postpone",
        headers=auth_header(token),
    )
    assert postponed.status_code == 200
    assert postponed.json()["status"] == "postponed"

    tomorrow = get_today(client, token, "2099-01-03")
    assert tomorrow["summary"]["planned_tasks"] == 1
    assert len(tomorrow["carry_over"]) == 1
    item = tomorrow["items"][0]
    assert item["carry_over"] is True
    assert item["postpone_count"] == 1
    assert item["status"] == "pending"


def test_block_unblock(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    prepare_route(client, token)
    occurrence = get_today(client, token, "2099-01-02")["items"][0]

    blocked = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/block",
        headers=auth_header(token),
        json={"reason": "等待资料"},
    )
    assert blocked.status_code == 200
    assert blocked.json()["status"] == "blocked"

    unblocked = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/unblock",
        headers=auth_header(token),
    )
    assert unblocked.status_code == 200
    assert unblocked.json()["status"] == "pending"
    assert unblocked.json()["block_reason"] is None


def test_skip(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    prepare_route(client, token)
    occurrence = get_today(client, token, "2099-01-02")["items"][0]

    skipped = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/skip",
        headers=auth_header(token),
        json={"reason": "暂时不做"},
    )
    assert skipped.status_code == 200
    assert skipped.json()["status"] == "skipped"
    assert skipped.json()["skip_reason"] == "暂时不做"


def test_abandon(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    prepare_route(client, token)
    occurrence = get_today(client, token, "2099-01-02")["items"][0]

    abandoned = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/abandon",
        headers=auth_header(token),
    )
    assert abandoned.status_code == 200
    assert abandoned.json()["status"] == "abandoned"


def test_split_occurrence(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    prepare_route(client, token)
    occurrence = get_today(client, token, "2099-01-02")["items"][0]

    split = client.post(
        f"/api/v1/task-occurrences/{occurrence['id']}/split",
        headers=auth_header(token),
        json={"parts": 2},
    )
    assert split.status_code == 200, split.text
    children = split.json()
    assert len(children) == 2
    assert all(child["status"] == "pending" for child in children)
    assert all(child["parent_occurrence_id"] == occurrence["id"] for child in children)

    today = get_today(client, token, "2099-01-02")
    assert today["summary"]["planned_tasks"] == 2
    assert {item["split_index"] for item in today["items"]} == {1, 2}


def test_forecast(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    route, _ = prepare_route(client, token)

    response = client.get(
        f"/api/v1/routes/{route['id']}/forecast",
        headers=auth_header(token),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["remaining_minutes"] == 45
    assert data["throughput_minutes"] >= 30
    assert data["forecast_end_date"]

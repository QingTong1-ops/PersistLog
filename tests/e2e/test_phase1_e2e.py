from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_notifications import VALID_WEBHOOK


def test_phase1_end_to_end(client: TestClient) -> None:
    body = register(client, email="e2e@example.com")
    token = body["access_token"]
    today = date.today()
    plan = f"""# E2E 冲刺计划

- 开始：{today.isoformat()}
- 结束：{(today + timedelta(days=30)).isoformat()}
- 每日可用：120 分钟

## 阶段一：执行

### 第 1 周：启动

- [ ] E2E 任务（45 分钟）
  - 产出：一条完成记录
  - 验收：完成率进入看板
"""
    imported = client.post(
        "/api/v1/imports",
        headers=auth_header(token),
        files={"file": ("e2e.md", plan.encode("utf-8"), "text/markdown")},
    )
    assert imported.status_code == 201, imported.text
    preview = client.get(
        f"/api/v1/imports/{imported.json()['import_id']}/preview",
        headers=auth_header(token),
    )
    assert preview.status_code == 200
    confirmed = client.post(
        f"/api/v1/imports/{imported.json()['import_id']}/confirm",
        headers=auth_header(token),
    )
    assert confirmed.status_code == 200, confirmed.text
    route_id = confirmed.json()["route_id"]

    today_response = client.get(
        f"/api/v1/today?date={today.isoformat()}",
        headers=auth_header(token),
    )
    assert today_response.status_code == 200, today_response.text
    today_data = today_response.json()
    assert today_data["summary"]["planned_tasks"] == 1
    occurrence_id = today_data["items"][0]["id"]

    completed = client.post(
        f"/api/v1/task-occurrences/{occurrence_id}/complete",
        headers=auth_header(token),
        json={"actual_minutes": 40},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"

    overview = client.get(
        f"/api/v1/dashboard/overview?date={today.isoformat()}&days=1",
        headers=auth_header(token),
    )
    assert overview.status_code == 200
    assert overview.json()["completed_tasks"] == 1
    assert overview.json()["route_progress"]["completed_tasks"] == 1
    assert route_id

    channel = client.post(
        "/api/v1/notification-channels",
        headers=auth_header(token),
        json={"name": "E2E 渠道", "webhook_url": VALID_WEBHOOK},
    )
    assert channel.status_code == 201
    tested = client.post(
        f"/api/v1/notification-channels/{channel.json()['id']}/test",
        headers=auth_header(token),
    )
    assert tested.status_code == 200
    assert tested.json()["status"] == "sent"

    outbox = client.get("/api/v1/notification-outbox", headers=auth_header(token))
    assert outbox.status_code == 200
    assert outbox.json()[0]["status"] == "sent"

    audit = client.get(
        "/api/v1/audit-logs?action=import.confirm", headers=auth_header(token)
    )
    assert audit.status_code == 200
    assert len(audit.json()) == 1

    openapi = client.get("/openapi.json")
    assert openapi.status_code == 200
    assert "/api/v1/imports" in openapi.json()["paths"]

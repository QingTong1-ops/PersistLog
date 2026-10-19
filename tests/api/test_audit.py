from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_notifications import VALID_WEBHOOK


def test_import_and_route_audit(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    today = date.today().isoformat()
    plan = f"""# 审计计划

- 开始：{today}
- 结束：{today}

## 阶段一：审计

### 第 1 周：审计周

- [ ] 审计任务（45 分钟）
  - 产出：记录
  - 验收：通过
"""
    imported = client.post(
        "/api/v1/imports",
        headers=auth_header(token),
        files={"file": ("plan.md", plan.encode("utf-8"), "text/markdown")},
    )
    assert imported.status_code == 201, imported.text
    import_id = imported.json()["import_id"]
    confirmed = client.post(
        f"/api/v1/imports/{import_id}/confirm",
        headers=auth_header(token),
    )
    assert confirmed.status_code == 200, confirmed.text
    route_id = confirmed.json()["route_id"]

    adjusted = client.post(
        f"/api/v1/routes/{route_id}/adjust",
        headers=auth_header(token),
        json={"daily_capacity_minutes": 180},
    )
    assert adjusted.status_code == 200

    logs = client.get(
        "/api/v1/audit-logs?action=import.confirm", headers=auth_header(token)
    )
    assert logs.status_code == 200
    assert len(logs.json()) == 1
    assert logs.json()[0]["target_id"] == import_id
    assert logs.json()[0]["after"]["route_id"] == route_id
    assert logs.json()[0]["request_id"]

    adjust_logs = client.get(
        "/api/v1/audit-logs?action=route.adjust", headers=auth_header(token)
    )
    assert adjust_logs.status_code == 200
    assert len(adjust_logs.json()) == 1
    assert adjust_logs.json()[0]["after"]["daily_capacity_minutes"] == 180


def test_notification_channel_audit_and_isolation(client: TestClient) -> None:
    alice = register(client, email="audit-alice@example.com")
    bob = register(client, email="audit-bob@example.com")
    created = client.post(
        "/api/v1/notification-channels",
        headers=auth_header(alice["access_token"]),
        json={"name": "审计渠道", "webhook_url": VALID_WEBHOOK},
    )
    assert created.status_code == 201
    channel_id = created.json()["id"]
    updated = client.patch(
        f"/api/v1/notification-channels/{channel_id}",
        headers=auth_header(alice["access_token"]),
        json={"name": "审计渠道 v2"},
    )
    assert updated.status_code == 200
    deleted = client.delete(
        f"/api/v1/notification-channels/{channel_id}",
        headers=auth_header(alice["access_token"]),
    )
    assert deleted.status_code == 204

    logs = client.get("/api/v1/audit-logs", headers=auth_header(alice["access_token"]))
    assert logs.status_code == 200
    actions = [item["action"] for item in logs.json()]
    assert "notification.channel.create" in actions
    assert "notification.channel.update" in actions
    assert "notification.channel.delete" in actions
    serialized = str(logs.json())
    assert "0123456789abcdef" not in serialized

    bob_logs = client.get("/api/v1/audit-logs", headers=auth_header(bob["access_token"]))
    assert bob_logs.status_code == 200
    assert bob_logs.json() == []

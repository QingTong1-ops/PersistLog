from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register

PLAN = """# 30 天后端冲刺

- 开始：2099-01-01
- 结束：2099-01-30
- 每日可用：120 分钟

## 阶段一：基础夯实

### 第 1 周：网络基础

- [ ] TCP 三次握手（45 分钟）
  - 产出：口述录音/笔记
  - 验收：不看资料讲清状态机
- [ ] HTTP 缓存（30 分钟）
  - 产出：思维导图
  - 验收：能区分强缓存/协商缓存
"""


def _upload(client: TestClient, token: str, content: str = PLAN, filename: str = "plan.md"):
    return client.post(
        "/api/v1/imports",
        headers=auth_header(token),
        files={"file": (filename, content.encode("utf-8"), "text/markdown")},
    )


def test_import_preview_edit_confirm_rollback(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]

    created = _upload(client, token)
    assert created.status_code == 201, created.text
    payload = created.json()
    assert payload["status"] == "needs_review"
    import_id = payload["import_id"]
    job_id = payload["job_id"]
    assert job_id

    listing = client.get("/api/v1/imports", headers=auth_header(token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["file_name"] == "plan.md"
    assert listing.json()[0]["status"] == "needs_review"

    preview = client.get(
        f"/api/v1/imports/{import_id}/preview",
        headers=auth_header(token),
    )
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert data["stats"]["tasks"] == 2
    task = data["route"]["stages"][0]["weeks"][0]["tasks"][0]
    assert task["title"] == "TCP 三次握手"

    task["title"] = "TCP 三次握手（已编辑）"
    edited = client.patch(
        f"/api/v1/imports/{import_id}/preview",
        headers=auth_header(token),
        json={"route": data["route"]},
    )
    assert edited.status_code == 200, edited.text
    assert (
        edited.json()["route"]["stages"][0]["weeks"][0]["tasks"][0]["title"]
        == "TCP 三次握手（已编辑）"
    )

    confirmed = client.post(
        f"/api/v1/imports/{import_id}/confirm",
        headers=auth_header(token),
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["created_tasks"] == 2
    route_id = confirmed.json()["route_id"]

    repeated = client.post(
        f"/api/v1/imports/{import_id}/confirm",
        headers=auth_header(token),
    )
    assert repeated.status_code == 200
    assert repeated.json()["route_id"] == route_id
    assert repeated.json()["created_tasks"] == 2

    detail = client.get(
        f"/api/v1/imports/{import_id}",
        headers=auth_header(token),
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "confirmed"
    assert detail.json()["route_id"] == route_id

    rolled_back = client.post(
        f"/api/v1/imports/{import_id}/rollback",
        headers=auth_header(token),
    )
    assert rolled_back.status_code == 204

    detail = client.get(
        f"/api/v1/imports/{import_id}",
        headers=auth_header(token),
    )
    assert detail.json()["status"] == "rolled_back"


def test_import_rejects_non_markdown(client: TestClient) -> None:
    body = register(client)
    response = _upload(client, body["access_token"], "hello", "plan.txt")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"


def test_import_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/imports",
        files={"file": ("plan.md", PLAN.encode("utf-8"), "text/markdown")},
    )
    assert response.status_code == 401


def test_import_user_isolation(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    created = _upload(client, alice["access_token"])
    import_id = created.json()["import_id"]

    response = client.get(
        f"/api/v1/imports/{import_id}/preview",
        headers=auth_header(bob["access_token"]),
    )
    assert response.status_code == 404


def test_import_cancel(client: TestClient) -> None:
    body = register(client)
    created = _upload(client, body["access_token"])
    import_id = created.json()["import_id"]
    cancelled = client.post(
        f"/api/v1/imports/{import_id}/cancel",
        headers=auth_header(body["access_token"]),
    )
    assert cancelled.status_code == 204
    detail = client.get(
        f"/api/v1/imports/{import_id}",
        headers=auth_header(body["access_token"]),
    )
    assert detail.json()["status"] == "cancelled"

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register

VALID_WEBHOOK = (
    "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?"
    "key=0123456789abcdef-1234-5678-90ab-cdef01234567"
)


def create_channel(client: TestClient, token: str, name: str = "我的企微群"):
    return client.post(
        "/api/v1/notification-channels",
        headers=auth_header(token),
        json={"name": name, "webhook_url": VALID_WEBHOOK},
    )


def test_channel_crud_and_test_send(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]

    created = create_channel(client, token)
    assert created.status_code == 201, created.text
    channel = created.json()
    assert channel["name"] == "我的企微群"
    assert channel["status"] == "active"
    assert "****4567" in channel["webhook_masked"]
    assert "0123456789abcdef" not in channel["webhook_masked"]
    channel_id = channel["id"]

    listing = client.get("/api/v1/notification-channels", headers=auth_header(token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    updated = client.patch(
        f"/api/v1/notification-channels/{channel_id}",
        headers=auth_header(token),
        json={"name": "改名后的群", "quiet_hours": {"start": "22:00", "end": "08:00"}},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "改名后的群"
    assert updated.json()["quiet_hours"] == {"start": "22:00", "end": "08:00"}

    tested = client.post(
        f"/api/v1/notification-channels/{channel_id}/test",
        headers=auth_header(token),
    )
    assert tested.status_code == 200, tested.text
    assert tested.json()["status"] == "sent"

    outbox = client.get("/api/v1/notification-outbox", headers=auth_header(token))
    assert outbox.status_code == 200
    assert len(outbox.json()) == 1
    assert outbox.json()[0]["status"] == "sent"
    assert outbox.json()[0]["template_code"] == "test"

    refreshed = client.get("/api/v1/notification-channels", headers=auth_header(token))
    assert refreshed.json()[0]["last_test_at"] is not None

    deleted = client.delete(
        f"/api/v1/notification-channels/{channel_id}",
        headers=auth_header(token),
    )
    assert deleted.status_code == 204
    assert client.get(
        "/api/v1/notification-channels", headers=auth_header(token)
    ).json() == []


def test_invalid_webhook_is_rejected(client: TestClient) -> None:
    body = register(client)
    response = client.post(
        "/api/v1/notification-channels",
        headers=auth_header(body["access_token"]),
        json={
            "name": "非法渠道",
            "webhook_url": "http://evil.example.com/cgi-bin/webhook/send?key=0123456789abcdef",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "NOTIFICATION_CHANNEL_INVALID"


def test_templates_and_preferences(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    channel = create_channel(client, token).json()

    templates = client.get(
        "/api/v1/notification-templates", headers=auth_header(token)
    )
    assert templates.status_code == 200
    codes = {item["code"] for item in templates.json()}
    assert {"morning", "evening", "overdue", "carry_over", "weekly"} <= codes

    updated = client.put(
        "/api/v1/notification-preferences",
        headers=auth_header(token),
        json={
            "items": [
                {
                    "event_type": "morning",
                    "channel_id": channel["id"],
                    "enabled": True,
                    "send_time": "07:30:00",
                    "timezone": "Asia/Shanghai",
                    "quiet_hours_behavior": "delay",
                }
            ]
        },
    )
    assert updated.status_code == 200, updated.text
    items = updated.json()
    assert len(items) == 1
    assert items[0]["event_type"] == "morning"
    assert items[0]["enabled"] is True

    preferences = client.get(
        "/api/v1/notification-preferences", headers=auth_header(token)
    )
    assert preferences.status_code == 200
    assert len(preferences.json()) == 1


def test_notification_user_isolation(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    channel = create_channel(client, alice["access_token"]).json()

    bob_channels = client.get(
        "/api/v1/notification-channels", headers=auth_header(bob["access_token"])
    )
    assert bob_channels.status_code == 200
    assert bob_channels.json() == []

    bob_test = client.post(
        f"/api/v1/notification-channels/{channel['id']}/test",
        headers=auth_header(bob["access_token"]),
    )
    assert bob_test.status_code == 404

    bob_outbox = client.get(
        "/api/v1/notification-outbox", headers=auth_header(bob["access_token"])
    )
    assert bob_outbox.status_code == 200
    assert bob_outbox.json() == []

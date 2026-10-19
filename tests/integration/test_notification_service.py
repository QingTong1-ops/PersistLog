from __future__ import annotations

from datetime import UTC, datetime

from app.models.notification import NotificationChannel, NotificationOutbox
from app.models.user import User
from app.notification.provider import LoggingProvider, NotificationSendError
from app.schemas.notification import PreferenceItem
from app.services import notification_service
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

VALID_WEBHOOK = (
    "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?"
    "key=0123456789abcdef-1234-5678-90ab-cdef01234567"
)


class FailingProvider:
    def send(self, webhook_url: str, content: str) -> None:
        del webhook_url, content
        raise NotificationSendError("simulated failure")


def _setup(client: TestClient, db: Session, email: str) -> tuple[User, NotificationChannel]:
    body = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "StrongPass123!"},
    )
    assert body.status_code in (200, 201), body.text
    token = body.json()["access_token"]
    created = client.post(
        "/api/v1/notification-channels",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "测试渠道", "webhook_url": VALID_WEBHOOK},
    )
    assert created.status_code == 201, created.text
    user = db.scalar(select(User).where(User.email == email))
    channel = db.scalar(
        select(NotificationChannel).where(NotificationChannel.id == created.json()["id"])
    )
    assert user is not None and channel is not None
    assert VALID_WEBHOOK not in channel.config_ciphertext
    return user, channel


def test_dedup_and_disabled_preference(client: TestClient, db: Session) -> None:
    user, channel = _setup(client, db, "dedup@example.com")
    payload = {"date": "2026-01-01", "planned_tasks": 1}

    first = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="morning",
        payload=payload,
        dedup_key="morning:test",
        event_type="morning",
        ignore_quiet_hours=True,
    )
    second = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="morning",
        payload=payload,
        dedup_key="morning:test",
        event_type="morning",
        ignore_quiet_hours=True,
    )
    assert first is not None and second is not None
    assert first.id == second.id
    count = db.scalar(
        select(func.count()).select_from(NotificationOutbox).where(
            NotificationOutbox.user_id == user.id
        )
    )
    assert count == 1

    notification_service.upsert_preferences(
        db,
        user,
        [
            PreferenceItem(
                event_type="morning",
                channel_id=channel.id,
                enabled=False,
                timezone="Asia/Shanghai",
            )
        ],
    )
    disabled = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="morning",
        payload=payload,
        dedup_key="morning:disabled",
        event_type="morning",
        ignore_quiet_hours=True,
    )
    assert disabled is None


def test_quiet_hours_delay_and_drop(client: TestClient, db: Session) -> None:
    user, channel = _setup(client, db, "quiet@example.com")
    now = datetime(2026, 1, 1, 15, 30, tzinfo=UTC)  # 23:30 Asia/Shanghai

    delayed = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="morning",
        payload={"date": "2026-01-02"},
        dedup_key="quiet:morning",
        event_type="morning",
        now=now,
    )
    assert delayed is not None
    assert delayed.status == "pending"
    assert delayed.next_retry_at is not None

    dropped = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="overdue",
        payload={"overdue_count": 2},
        dedup_key="quiet:overdue",
        event_type="overdue",
        now=now,
    )
    assert dropped is None


def test_retry_exhaustion_and_success(client: TestClient, db: Session) -> None:
    user, channel = _setup(client, db, "retry@example.com")
    outbox = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="test",
        payload={"message": "retry"},
        dedup_key="retry:1",
        event_type="test",
        ignore_quiet_hours=True,
    )
    assert outbox is not None

    failing = FailingProvider()
    statuses = []
    for _ in range(4):
        notification_service.send_outbox(db, outbox, failing)
        statuses.append(outbox.status)
    assert statuses == ["failed", "failed", "failed", "dead"]
    assert outbox.retry_count == 4

    resent = notification_service.resend_outbox(db, user, outbox.id)
    assert resent.status == "sent"

    success_outbox = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="test",
        payload={"message": "success"},
        dedup_key="retry:2",
        event_type="test",
        ignore_quiet_hours=True,
    )
    assert success_outbox is not None
    sent = notification_service.send_outbox(db, success_outbox, LoggingProvider())
    assert sent.status == "sent"
    assert sent.sent_at is not None


def test_send_pending(client: TestClient, db: Session) -> None:
    user, channel = _setup(client, db, "pending@example.com")
    outbox = notification_service.enqueue_notification(
        db,
        user,
        channel,
        template_code="test",
        payload={"message": "pending"},
        dedup_key="pending:1",
        event_type="test",
        ignore_quiet_hours=True,
    )
    assert outbox is not None
    assert outbox.status == "pending"
    assert notification_service.send_pending(db) == 1
    db.refresh(outbox)
    assert outbox.status == "sent"

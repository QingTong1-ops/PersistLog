from __future__ import annotations

import json
from collections import defaultdict
from datetime import UTC, datetime, time, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret, encrypt_secret, mask_webhook
from app.core.errors import AppError
from app.core.time import user_now
from app.models.notification import (
    NotificationChannel,
    NotificationOutbox,
    NotificationPreference,
    NotificationTemplate,
)
from app.models.user import User
from app.notification.provider import get_provider
from app.schemas.notification import ChannelCreate, ChannelUpdate, PreferenceItem

DEFAULT_QUIET_HOURS = {"start": "23:00", "end": "07:00"}
ALLOWED_EVENTS = {"morning", "evening", "overdue", "carry_over", "weekly", "test"}
DELAY_EVENTS = {"morning", "evening", "weekly"}
RETRY_DELAYS = [1, 5, 30]
MAX_RETRIES = 3


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _parse_time(value: str) -> time:
    try:
        return time.fromisoformat(value)
    except ValueError as exc:
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "免打扰时间格式错误", status_code=422) from exc


def normalize_quiet_hours(value: dict[str, str] | None) -> dict[str, str]:
    if not value:
        return dict(DEFAULT_QUIET_HOURS)
    start = _parse_time(str(value.get("start") or ""))
    end = _parse_time(str(value.get("end") or ""))
    if start == end:
        raise AppError("NOTIFICATION_CHANNEL_INVALID", "免打扰起止时间不能相同", status_code=422)
    return {"start": start.strftime("%H:%M"), "end": end.strftime("%H:%M")}


def in_quiet_hours(local_now: datetime, quiet_hours: dict[str, str] | None) -> bool:
    quiet = quiet_hours or DEFAULT_QUIET_HOURS
    start = _parse_time(str(quiet["start"]))
    end = _parse_time(str(quiet["end"]))
    current = local_now.time().replace(tzinfo=None)
    if start < end:
        return start <= current < end
    return current >= start or current < end


def _quiet_end_utc(local_now: datetime, quiet_hours: dict[str, str] | None) -> datetime:
    quiet = quiet_hours or DEFAULT_QUIET_HOURS
    end = _parse_time(str(quiet["end"]))
    start = _parse_time(str(quiet["start"]))
    zone = local_now.tzinfo or ZoneInfo("Asia/Shanghai")
    end_local = datetime.combine(local_now.date(), end, tzinfo=zone)
    if start > end and local_now.time().replace(tzinfo=None) >= start:
        end_local += timedelta(days=1)
    elif local_now.time().replace(tzinfo=None) >= end:
        end_local += timedelta(days=1)
    return end_local.astimezone(UTC).replace(tzinfo=None)


def render_template(body: str, payload: dict[str, Any]) -> str:
    try:
        return body.format_map(defaultdict(str, payload))
    except (KeyError, ValueError):
        return body


def _masked_channel(channel: NotificationChannel) -> dict[str, Any]:
    try:
        config = json.loads(decrypt_secret(channel.config_ciphertext))
        masked = mask_webhook(str(config.get("webhook_url") or ""))
    except (AppError, json.JSONDecodeError):
        masked = "***"
    return {
        "id": channel.id,
        "channel_type": channel.channel_type,
        "name": channel.name,
        "webhook_masked": masked,
        "status": channel.status,
        "quiet_hours": channel.quiet_hours_json,
        "last_test_at": channel.last_test_at,
        "last_error": channel.last_error,
        "created_at": channel.created_at,
    }


def get_channel(db: Session, user: User, channel_id: str) -> NotificationChannel:
    channel = db.scalar(
        select(NotificationChannel).where(
            NotificationChannel.id == channel_id,
            NotificationChannel.user_id == user.id,
        )
    )
    if channel is None:
        raise AppError("NOTIFICATION_CHANNEL_NOT_FOUND", "通知渠道不存在", status_code=404)
    return channel


def list_channels(db: Session, user: User) -> list[NotificationChannel]:
    return list(
        db.scalars(
            select(NotificationChannel)
            .where(NotificationChannel.user_id == user.id)
            .order_by(NotificationChannel.created_at.desc())
        )
    )


def create_channel(db: Session, user: User, payload: ChannelCreate) -> NotificationChannel:
    from app.notification.provider import validate_webhook_url

    validate_webhook_url(payload.webhook_url)
    quiet_hours = normalize_quiet_hours(
        payload.quiet_hours.model_dump() if payload.quiet_hours else None
    )
    channel = NotificationChannel(
        user_id=user.id,
        channel_type="wecom_group_bot",
        name=payload.name,
        config_ciphertext=encrypt_secret(json.dumps({"webhook_url": payload.webhook_url})),
        status="active",
        quiet_hours_json=quiet_hours,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


def update_channel(
    db: Session, user: User, channel_id: str, payload: ChannelUpdate
) -> NotificationChannel:
    from app.notification.provider import validate_webhook_url

    channel = get_channel(db, user, channel_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("webhook_url"):
        validate_webhook_url(data["webhook_url"])
        channel.config_ciphertext = encrypt_secret(
            json.dumps({"webhook_url": data["webhook_url"]})
        )
    if data.get("name") is not None:
        channel.name = data["name"]
    if data.get("status") is not None:
        channel.status = data["status"]
    if "quiet_hours" in data:
        channel.quiet_hours_json = normalize_quiet_hours(data["quiet_hours"])
    db.commit()
    db.refresh(channel)
    return channel


def delete_channel(db: Session, user: User, channel_id: str) -> None:
    channel = get_channel(db, user, channel_id)
    db.delete(channel)
    db.commit()


def channel_payload(channel: NotificationChannel) -> dict[str, Any]:
    return _masked_channel(channel)


def list_templates(
    db: Session, channel_type: str = "wecom_group_bot", locale: str = "zh-CN"
) -> list[NotificationTemplate]:
    return list(
        db.scalars(
            select(NotificationTemplate)
            .where(
                NotificationTemplate.channel_type == channel_type,
                NotificationTemplate.locale == locale,
                NotificationTemplate.status == "active",
            )
            .order_by(NotificationTemplate.code, NotificationTemplate.version.desc())
        )
    )


def get_template(db: Session, code: str, channel_type: str) -> NotificationTemplate | None:
    return db.scalar(
        select(NotificationTemplate)
        .where(
            NotificationTemplate.code == code,
            NotificationTemplate.channel_type == channel_type,
            NotificationTemplate.status == "active",
        )
        .order_by(NotificationTemplate.version.desc())
    )


def get_preference(
    db: Session, user: User, event_type: str, channel_id: str
) -> NotificationPreference | None:
    return db.scalar(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user.id,
            NotificationPreference.event_type == event_type,
            NotificationPreference.channel_id == channel_id,
        )
    )


def list_preferences(db: Session, user: User) -> list[NotificationPreference]:
    return list(
        db.scalars(
            select(NotificationPreference)
            .where(NotificationPreference.user_id == user.id)
            .order_by(NotificationPreference.event_type, NotificationPreference.channel_id)
        )
    )


def upsert_preferences(
    db: Session, user: User, items: list[PreferenceItem]
) -> list[NotificationPreference]:
    for item in items:
        if item.event_type not in ALLOWED_EVENTS:
            raise AppError("NOTIFICATION_PREFERENCE_INVALID", "通知事件类型无效", status_code=422)
        get_channel(db, user, item.channel_id)
        try:
            ZoneInfo(item.timezone)
        except ZoneInfoNotFoundError as exc:
            raise AppError(
                "NOTIFICATION_PREFERENCE_INVALID", "通知时区无效", status_code=422
            ) from exc
        preference = get_preference(db, user, item.event_type, item.channel_id)
        if preference is None:
            preference = NotificationPreference(
                user_id=user.id,
                event_type=item.event_type,
                channel_id=item.channel_id,
            )
            db.add(preference)
        preference.enabled = item.enabled
        preference.send_time = item.send_time
        preference.timezone = item.timezone
        preference.quiet_hours_behavior = item.quiet_hours_behavior
    db.commit()
    return list_preferences(db, user)


def list_outbox(
    db: Session, user: User, status: str | None = None, limit: int = 50
) -> list[NotificationOutbox]:
    statement = select(NotificationOutbox).where(NotificationOutbox.user_id == user.id)
    if status:
        statement = statement.where(NotificationOutbox.status == status)
    statement = statement.order_by(NotificationOutbox.created_at.desc()).limit(min(limit, 200))
    return list(db.scalars(statement))


def enqueue_notification(
    db: Session,
    user: User,
    channel: NotificationChannel,
    *,
    template_code: str,
    payload: dict[str, Any],
    dedup_key: str,
    event_type: str | None = None,
    now: datetime | None = None,
    ignore_quiet_hours: bool = False,
) -> NotificationOutbox | None:
    existing = db.scalar(
        select(NotificationOutbox).where(
            NotificationOutbox.user_id == user.id,
            NotificationOutbox.dedup_key == dedup_key,
        )
    )
    if existing is not None:
        return existing
    if channel.status != "active":
        return None

    event = event_type or template_code
    preference = get_preference(db, user, event, channel.id)
    if preference is not None and not preference.enabled:
        return None

    next_retry_at: datetime | None = None
    if not ignore_quiet_hours:
        quiet = channel.quiet_hours_json or DEFAULT_QUIET_HOURS
        local_now = user_now(user.timezone, now)
        if in_quiet_hours(local_now, quiet):
            behavior = (
                preference.quiet_hours_behavior
                if preference is not None
                else ("delay" if event in DELAY_EVENTS else "drop")
            )
            if behavior == "drop":
                return None
            next_retry_at = _quiet_end_utc(local_now, quiet)

    outbox = NotificationOutbox(
        user_id=user.id,
        channel_id=channel.id,
        template_code=template_code,
        payload_json=payload,
        dedup_key=dedup_key,
        status="pending",
        retry_count=0,
        next_retry_at=next_retry_at,
    )
    db.add(outbox)
    db.commit()
    db.refresh(outbox)
    return outbox


def _render_outbox(
    db: Session, outbox: NotificationOutbox, channel: NotificationChannel
) -> str:
    template = get_template(db, outbox.template_code, channel.channel_type)
    if template is None:
        fallback = outbox.payload_json.get("message")
        if fallback:
            return str(fallback)
        raise AppError("NOTIFICATION_TEMPLATE_NOT_FOUND", "通知模板不存在", status_code=422)
    return render_template(template.body, outbox.payload_json)


def send_outbox(
    db: Session,
    outbox: NotificationOutbox,
    provider=None,
) -> NotificationOutbox:
    if outbox.status == "sent":
        return outbox
    channel = db.get(NotificationChannel, outbox.channel_id)
    if channel is None or channel.status != "active":
        outbox.status = "dead"
        outbox.last_error = "通知渠道不可用"
        db.commit()
        db.refresh(outbox)
        return outbox

    provider = provider or get_provider()
    try:
        config = json.loads(decrypt_secret(channel.config_ciphertext))
        content = _render_outbox(db, outbox, channel)
        outbox.status = "sending"
        db.commit()
        provider.send(str(config.get("webhook_url") or ""), content)
    except Exception as exc:  # provider/network/template failures all enter retry
        outbox.retry_count += 1
        outbox.last_error = str(exc)[:500]
        if outbox.retry_count > MAX_RETRIES:
            outbox.status = "dead"
            outbox.next_retry_at = None
        else:
            outbox.status = "failed"
            delay = RETRY_DELAYS[min(outbox.retry_count - 1, len(RETRY_DELAYS) - 1)]
            outbox.next_retry_at = _naive_utcnow() + timedelta(minutes=delay)
        channel.last_error = str(exc)[:500]
        db.commit()
        db.refresh(outbox)
        return outbox

    outbox.status = "sent"
    outbox.sent_at = _naive_utcnow()
    outbox.next_retry_at = None
    outbox.last_error = None
    channel.last_error = None
    if outbox.template_code == "test":
        channel.last_test_at = _naive_utcnow()
    db.commit()
    db.refresh(outbox)
    return outbox


def enqueue_and_send(
    db: Session,
    user: User,
    channel: NotificationChannel,
    *,
    template_code: str,
    payload: dict[str, Any],
    dedup_key: str,
    event_type: str | None = None,
    now: datetime | None = None,
    ignore_quiet_hours: bool = False,
) -> NotificationOutbox | None:
    outbox = enqueue_notification(
        db,
        user,
        channel,
        template_code=template_code,
        payload=payload,
        dedup_key=dedup_key,
        event_type=event_type,
        now=now,
        ignore_quiet_hours=ignore_quiet_hours,
    )
    if outbox is None:
        return None
    return send_outbox(db, outbox)


def test_channel(db: Session, user: User, channel_id: str) -> NotificationOutbox:
    channel = get_channel(db, user, channel_id)
    payload = {
        "message": f"恒序 · 测试消息\n渠道：{channel.name}\n时间：{_naive_utcnow().isoformat()}",
        "date": _naive_utcnow().date().isoformat(),
    }
    outbox = enqueue_and_send(
        db,
        user,
        channel,
        template_code="test",
        payload=payload,
        dedup_key=f"test:{channel.id}:{uuid4()}",
        event_type="test",
        ignore_quiet_hours=True,
    )
    if outbox is None:
        raise AppError("NOTIFICATION_SEND_FAILED", "测试消息未生成", status_code=502)
    return outbox


def resend_outbox(db: Session, user: User, outbox_id: str) -> NotificationOutbox:
    outbox = db.scalar(
        select(NotificationOutbox).where(
            NotificationOutbox.id == outbox_id,
            NotificationOutbox.user_id == user.id,
        )
    )
    if outbox is None:
        raise AppError("NOTIFICATION_OUTBOX_NOT_FOUND", "通知记录不存在", status_code=404)
    if outbox.status not in {"failed", "dead"}:
        raise AppError("NOTIFICATION_OUTBOX_INVALID", "当前通知状态不能重发", status_code=409)
    outbox.status = "pending"
    outbox.retry_count = 0
    outbox.next_retry_at = None
    outbox.last_error = None
    db.commit()
    db.refresh(outbox)
    return send_outbox(db, outbox)


def send_pending(db: Session, limit: int = 50) -> int:
    now = _naive_utcnow()
    rows = list(
        db.scalars(
            select(NotificationOutbox)
            .where(
                NotificationOutbox.status.in_(["pending", "failed"]),
                NotificationOutbox.retry_count <= MAX_RETRIES,
                (NotificationOutbox.next_retry_at.is_(None))
                | (NotificationOutbox.next_retry_at <= now),
            )
            .order_by(NotificationOutbox.created_at)
            .limit(min(limit, 200))
        )
    )
    for outbox in rows:
        send_outbox(db, outbox)
    return len(rows)

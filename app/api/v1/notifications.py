from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import check_rate_limit
from app.schemas.notification import (
    ChannelCreate,
    ChannelOut,
    ChannelTestResponse,
    ChannelUpdate,
    OutboxOut,
    PreferenceOut,
    PreferencesUpdate,
    TemplateOut,
)
from app.services import audit_service, notification_service

router = APIRouter(tags=["notifications"])


def _channel_audit(channel) -> dict:
    return {
        "name": channel.name,
        "status": channel.status,
        "quiet_hours": channel.quiet_hours_json,
    }


@router.get("/notification-channels", response_model=list[ChannelOut])
def list_channels(user: CurrentUser, db: DbSession) -> list[ChannelOut]:
    return [
        ChannelOut.model_validate(notification_service.channel_payload(channel))
        for channel in notification_service.list_channels(db, user)
    ]


@router.post(
    "/notification-channels",
    response_model=ChannelOut,
    status_code=status.HTTP_201_CREATED,
)
def create_channel(
    user: CurrentUser, db: DbSession, request: Request, payload: ChannelCreate
) -> ChannelOut:
    channel = notification_service.create_channel(db, user, payload)
    audit_service.record(
        db,
        user,
        action="notification.channel.create",
        target_type="notification_channel",
        target_id=channel.id,
        after=_channel_audit(channel),
        request=request,
    )
    return ChannelOut.model_validate(notification_service.channel_payload(channel))


@router.patch("/notification-channels/{channel_id}", response_model=ChannelOut)
def update_channel(
    user: CurrentUser,
    db: DbSession,
    request: Request,
    channel_id: str,
    payload: ChannelUpdate,
) -> ChannelOut:
    before = _channel_audit(notification_service.get_channel(db, user, channel_id))
    channel = notification_service.update_channel(db, user, channel_id, payload)
    audit_service.record(
        db,
        user,
        action="notification.channel.update",
        target_type="notification_channel",
        target_id=channel.id,
        before=before,
        after=_channel_audit(channel),
        request=request,
    )
    return ChannelOut.model_validate(notification_service.channel_payload(channel))


@router.delete("/notification-channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(
    user: CurrentUser, db: DbSession, request: Request, channel_id: str
) -> Response:
    before = _channel_audit(notification_service.get_channel(db, user, channel_id))
    notification_service.delete_channel(db, user, channel_id)
    audit_service.record(
        db,
        user,
        action="notification.channel.delete",
        target_type="notification_channel",
        target_id=channel_id,
        before=before,
        request=request,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notification-channels/{channel_id}/test", response_model=ChannelTestResponse)
def test_channel(
    user: CurrentUser, db: DbSession, channel_id: str
) -> ChannelTestResponse:
    check_rate_limit(f"notification-test:{user.id}", 5, 3600)
    outbox = notification_service.test_channel(db, user, channel_id)
    return ChannelTestResponse(outbox_id=outbox.id, status=outbox.status)


@router.get("/notification-templates", response_model=list[TemplateOut])
def list_templates(
    user: CurrentUser,
    db: DbSession,
    channel_type: str = "wecom_group_bot",
    locale: str = "zh-CN",
) -> list[TemplateOut]:
    del user
    return [
        TemplateOut.model_validate(template)
        for template in notification_service.list_templates(db, channel_type, locale)
    ]


@router.get("/notification-preferences", response_model=list[PreferenceOut])
def list_preferences(user: CurrentUser, db: DbSession) -> list[PreferenceOut]:
    return [
        PreferenceOut.model_validate(item)
        for item in notification_service.list_preferences(db, user)
    ]


@router.put("/notification-preferences", response_model=list[PreferenceOut])
def update_preferences(
    user: CurrentUser, db: DbSession, payload: PreferencesUpdate
) -> list[PreferenceOut]:
    return [
        PreferenceOut.model_validate(item)
        for item in notification_service.upsert_preferences(db, user, payload.items)
    ]


@router.get("/notification-outbox", response_model=list[OutboxOut])
def list_outbox(
    user: CurrentUser,
    db: DbSession,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[OutboxOut]:
    return [
        OutboxOut.model_validate(item)
        for item in notification_service.list_outbox(
            db, user, status=status_filter, limit=limit
        )
    ]


@router.post("/notification-outbox/{outbox_id}/resend", response_model=OutboxOut)
def resend_outbox(
    user: CurrentUser, db: DbSession, outbox_id: str
) -> OutboxOut:
    return OutboxOut.model_validate(
        notification_service.resend_outbox(db, user, outbox_id)
    )

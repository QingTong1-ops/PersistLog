from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
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
from app.services import notification_service

router = APIRouter(tags=["notifications"])


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
    user: CurrentUser, db: DbSession, payload: ChannelCreate
) -> ChannelOut:
    channel = notification_service.create_channel(db, user, payload)
    return ChannelOut.model_validate(notification_service.channel_payload(channel))


@router.patch("/notification-channels/{channel_id}", response_model=ChannelOut)
def update_channel(
    user: CurrentUser,
    db: DbSession,
    channel_id: str,
    payload: ChannelUpdate,
) -> ChannelOut:
    channel = notification_service.update_channel(db, user, channel_id, payload)
    return ChannelOut.model_validate(notification_service.channel_payload(channel))


@router.delete("/notification-channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(user: CurrentUser, db: DbSession, channel_id: str) -> Response:
    notification_service.delete_channel(db, user, channel_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notification-channels/{channel_id}/test", response_model=ChannelTestResponse)
def test_channel(
    user: CurrentUser, db: DbSession, channel_id: str
) -> ChannelTestResponse:
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

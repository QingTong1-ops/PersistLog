from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field


class QuietHours(BaseModel):
    start: str = Field(pattern=r"^\d{2}:\d{2}$")
    end: str = Field(pattern=r"^\d{2}:\d{2}$")


class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    webhook_url: str = Field(min_length=1, max_length=1000)
    quiet_hours: QuietHours | None = None


class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    webhook_url: str | None = Field(default=None, min_length=1, max_length=1000)
    status: str | None = Field(default=None, pattern="^(active|disabled)$")
    quiet_hours: QuietHours | None = None


class ChannelOut(BaseModel):
    id: str
    channel_type: str
    name: str
    webhook_masked: str
    status: str
    quiet_hours: dict | None = None
    last_test_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime


class ChannelTestResponse(BaseModel):
    outbox_id: str
    status: str


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    channel_type: str
    locale: str
    subject: str | None = None
    body: str
    version: int
    status: str


class PreferenceItem(BaseModel):
    event_type: str = Field(min_length=1, max_length=64)
    channel_id: str
    enabled: bool = True
    send_time: time | None = None
    timezone: str = Field(default="Asia/Shanghai", max_length=64)
    quiet_hours_behavior: str = Field(default="delay", pattern="^(delay|drop)$")


class PreferencesUpdate(BaseModel):
    items: list[PreferenceItem] = Field(default_factory=list)


class PreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: str
    channel_id: str
    enabled: bool
    send_time: time | None = None
    timezone: str
    quiet_hours_behavior: str


class OutboxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel_id: str
    template_code: str
    dedup_key: str
    status: str
    retry_count: int
    next_retry_at: datetime | None = None
    sent_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime

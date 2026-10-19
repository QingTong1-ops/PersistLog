from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class OccurrenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    occurrence_date: date
    status: str
    planned_minutes: int
    actual_minutes: int | None = None
    remaining_minutes: int
    carry_over_from_id: str | None = None
    postpone_count: int
    skip_reason: str | None = None
    block_reason: str | None = None
    note: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    split_index: int
    parent_occurrence_id: str | None = None


class TodayItem(OccurrenceOut):
    title: str
    task_type: str
    stage_name: str | None = None
    week_focus: str | None = None
    source_type: str
    why: str
    is_optional: bool = False
    carry_over: bool = False


class TodaySummary(BaseModel):
    planned_tasks: int
    completed_tasks: int
    planned_minutes: int
    actual_minutes: int
    completion_rate: float


class TodayResponse(BaseModel):
    plan_id: str
    date: date
    timezone: str
    capacity_minutes: int
    summary: TodaySummary
    items: list[TodayItem] = Field(default_factory=list)
    carry_over: list[TodayItem] = Field(default_factory=list)


class CompleteRequest(BaseModel):
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)
    note: str | None = None


class SkipRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class BlockRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class OccurrenceUpdate(BaseModel):
    note: str | None = None
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)
    remaining_minutes: int | None = Field(default=None, ge=0, le=1440)


class SplitRequest(BaseModel):
    parts: int = Field(ge=2, le=4)


class ForecastOut(BaseModel):
    route_id: str
    remaining_minutes: int
    throughput_minutes: int
    forecast_days: int
    forecast_end_date: date

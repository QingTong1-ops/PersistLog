from __future__ import annotations

from datetime import time

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.auth import UserOut


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserOut
    education: str | None = None
    major: str | None = None
    graduation_year: int | None = None
    work_years: int | None = None
    tech_stack: list[str] | None = Field(
        default=None,
        validation_alias=AliasChoices("tech_stack", "tech_stack_json"),
    )
    daily_available_minutes: int
    planning_capacity_factor: float
    day_boundary_time: time
    preferred_start_time: time | None = None
    preferred_end_time: time | None = None
    bio: str | None = None


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=64)
    education: str | None = Field(default=None, max_length=100)
    major: str | None = Field(default=None, max_length=100)
    graduation_year: int | None = Field(default=None, ge=1900, le=2100)
    work_years: int | None = Field(default=None, ge=0, le=80)
    tech_stack: list[str] | None = None
    daily_available_minutes: int | None = Field(default=None, ge=30, le=1440)
    planning_capacity_factor: float | None = Field(default=None, ge=0.6, le=1.0)
    day_boundary_hour: int | None = Field(default=None, ge=0, le=23)
    preferred_start_time: time | None = None
    preferred_end_time: time | None = None
    bio: str | None = Field(default=None, max_length=2000)


class SettingsOut(BaseModel):
    timezone: str
    daily_available_minutes: int
    planning_capacity_factor: float
    day_boundary_hour: int


class SettingsUpdate(BaseModel):
    timezone: str | None = Field(default=None, max_length=64)
    daily_available_minutes: int | None = Field(default=None, ge=30, le=1440)
    planning_capacity_factor: float | None = Field(default=None, ge=0.6, le=1.0)
    day_boundary_hour: int | None = Field(default=None, ge=0, le=23)

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class JobTargetCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    industry: str | None = Field(default=None, max_length=100)
    company_type: str | None = Field(default=None, max_length=100)
    target_date: date | None = None
    priority: str = Field(default="P1", pattern="^P[0-2]$")
    is_primary: bool = False


class JobTargetUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    industry: str | None = Field(default=None, max_length=100)
    company_type: str | None = Field(default=None, max_length=100)
    target_date: date | None = None
    priority: str | None = Field(default=None, pattern="^P[0-2]$")
    is_primary: bool | None = None
    status: str | None = Field(default=None, pattern="^(active|archived)$")


class JobTargetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    city: str | None = None
    industry: str | None = None
    company_type: str | None = None
    target_date: date | None = None
    priority: str
    is_primary: bool
    status: str
    created_at: datetime

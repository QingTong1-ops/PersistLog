from __future__ import annotations

from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def new_uuid() -> str:
    return str(uuid4())


class DailyPlan(Base):
    __tablename__ = "daily_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    capacity_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    generated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    generation_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class TaskOccurrence(Base):
    __tablename__ = "task_occurrences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False
    )
    daily_plan_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("daily_plans.id", ondelete="SET NULL"), nullable=True
    )
    occurrence_date: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    priority_snapshot: Mapped[str | None] = mapped_column(String(16), nullable=True)
    planned_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    remaining_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    carry_over_from_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("task_occurrences.id", ondelete="SET NULL"), nullable=True
    )
    postpone_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skip_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    block_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    split_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    parent_occurrence_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("task_occurrences.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class DailyPlanItem(Base):
    __tablename__ = "daily_plan_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    daily_plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("daily_plans.id", ondelete="CASCADE"), nullable=False
    )
    task_occurrence_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_occurrences.id", ondelete="CASCADE"), nullable=False
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_optional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

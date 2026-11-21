from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def new_uuid() -> str:
    return str(uuid4())


_CODE_TEXT = Text().with_variant(MEDIUMTEXT(), "mysql")


class CodeDraft(Base):
    __tablename__ = "code_drafts"
    __table_args__ = (
        Index("idx_code_drafts_user_status", "user_id", "status", "updated_at"),
        Index("idx_code_drafts_user_task", "user_id", "task_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
    task_occurrence_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("task_occurrences.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_submission_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    problem_title: Mapped[str] = mapped_column(String(300), nullable=False)
    problem_source: Mapped[str | None] = mapped_column(String(300), nullable=True)
    difficulty: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unrated"
    )
    tags_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    language: Mapped[str] = mapped_column(String(16), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    code_text: Mapped[str] = mapped_column(_CODE_TEXT, nullable=False)
    line_count: Mapped[int] = mapped_column(Integer, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    self_test_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    time_complexity: Mapped[str] = mapped_column(String(64), nullable=False)
    space_complexity: Mapped[str] = mapped_column(String(64), nullable=False)
    approach: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_independent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    capability_codes_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    last_submission_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class CodeSubmission(Base):
    __tablename__ = "code_submissions"
    __table_args__ = (
        Index("idx_code_submissions_user_created", "user_id", "created_at"),
        Index("idx_code_submissions_user_task", "user_id", "task_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    draft_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("code_drafts.id", ondelete="SET NULL"), nullable=True
    )
    source_submission_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    task_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
    task_occurrence_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("task_occurrences.id", ondelete="SET NULL"),
        nullable=True,
    )
    problem_title: Mapped[str] = mapped_column(String(300), nullable=False)
    problem_source: Mapped[str | None] = mapped_column(String(300), nullable=True)
    difficulty: Mapped[str] = mapped_column(
        String(16), nullable=False, default="unrated"
    )
    tags_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    language: Mapped[str] = mapped_column(String(16), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    code_text: Mapped[str] = mapped_column(_CODE_TEXT, nullable=False)
    line_count: Mapped[int] = mapped_column(Integer, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    self_test_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    time_complexity: Mapped[str] = mapped_column(String(64), nullable=False)
    space_complexity: Mapped[str] = mapped_column(String(64), nullable=False)
    approach: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_independent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    capability_codes_json: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    consent_version: Mapped[str] = mapped_column(String(32), nullable=False)
    consent_scope: Mapped[str] = mapped_column(
        String(64), nullable=False, default="ai_code_review"
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="submitted")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

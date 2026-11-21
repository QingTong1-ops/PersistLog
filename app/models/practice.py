from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
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
    latest_evaluation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    latest_job_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    current_evaluation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    evaluation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    review_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="not_started"
    )
    latest_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class CodeEvaluation(Base):
    __tablename__ = "code_evaluations"
    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "sequence_no",
            name="uk_code_evaluation_sequence",
        ),
        Index("idx_code_evaluations_user_created", "user_id", "created_at"),
        Index(
            "idx_code_evaluations_submission_current",
            "submission_id",
            "is_current",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    submission_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("code_submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    ai_run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True
    )
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    level: Mapped[str | None] = mapped_column(String(8), nullable=True)
    confidence: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4), nullable=True
    )
    static_risk: Mapped[str | None] = mapped_column(String(16), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    dimensions_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evidence_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    strengths_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    improvements_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    followups_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    not_evaluated_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    process_steps_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    rubric_version: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

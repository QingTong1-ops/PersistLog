"""p2 code evaluations

Revision ID: 0004_p2_evaluations
Revises: 0003_p2_practice
Create Date: 2026-11-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0004_p2_evaluations"
down_revision: str | None = "0003_p2_practice"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "code_submissions",
        sa.Column("latest_evaluation_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "code_submissions",
        sa.Column("latest_job_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "code_submissions",
        sa.Column("current_evaluation_id", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "code_submissions",
        sa.Column(
            "evaluation_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "code_submissions",
        sa.Column(
            "review_status",
            sa.String(length=32),
            server_default="not_started",
            nullable=False,
        ),
    )
    op.add_column(
        "code_submissions",
        sa.Column("latest_score", sa.Integer(), nullable=True),
    )

    op.create_table(
        "code_evaluations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("submission_id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("ai_run_id", sa.String(length=36), nullable=True),
        sa.Column("sequence_no", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            server_default="queued",
            nullable=False,
        ),
        sa.Column(
            "is_current",
            sa.Boolean(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("level", sa.String(length=8), nullable=True),
        sa.Column("confidence", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("static_risk", sa.String(length=16), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("dimensions_json", sa.JSON(), nullable=True),
        sa.Column("evidence_json", sa.JSON(), nullable=True),
        sa.Column("strengths_json", sa.JSON(), nullable=True),
        sa.Column("improvements_json", sa.JSON(), nullable=True),
        sa.Column("followups_json", sa.JSON(), nullable=True),
        sa.Column("not_evaluated_json", sa.JSON(), nullable=True),
        sa.Column("process_steps_json", sa.JSON(), nullable=True),
        sa.Column("rubric_version", sa.String(length=32), nullable=False),
        sa.Column("prompt_version", sa.String(length=64), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("started_at", mysql.DATETIME(fsp=3), nullable=True),
        sa.Column("finished_at", mysql.DATETIME(fsp=3), nullable=True),
        sa.Column(
            "created_at",
            mysql.DATETIME(fsp=3),
            server_default=sa.text("CURRENT_TIMESTAMP(3)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            mysql.DATETIME(fsp=3),
            server_default=sa.text("CURRENT_TIMESTAMP(3)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_code_evaluations_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["submission_id"],
            ["code_submissions.id"],
            name="fk_code_evaluations_submission_id_submissions",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["job_id"],
            ["jobs.id"],
            name="fk_code_evaluations_job_id_jobs",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["ai_run_id"],
            ["ai_runs.id"],
            name="fk_code_evaluations_ai_run_id_ai_runs",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_code_evaluations"),
        sa.UniqueConstraint(
            "submission_id",
            "sequence_no",
            name="uk_code_evaluation_sequence",
        ),
    )
    op.create_index(
        "idx_code_evaluations_user_created",
        "code_evaluations",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_code_evaluations_submission_current",
        "code_evaluations",
        ["submission_id", "is_current"],
        unique=False,
    )


def downgrade() -> None:
    # Dropping the table removes its indexes and FKs; dropping the user index
    # first is rejected by MySQL because it backs a foreign key.
    op.drop_table("code_evaluations")
    op.drop_column("code_submissions", "latest_score")
    op.drop_column("code_submissions", "review_status")
    op.drop_column("code_submissions", "evaluation_count")
    op.drop_column("code_submissions", "current_evaluation_id")
    op.drop_column("code_submissions", "latest_job_id")
    op.drop_column("code_submissions", "latest_evaluation_id")

"""p2 practice drafts and submissions

Revision ID: 0003_p2_practice
Revises: 0002_common_foundation
Create Date: 2026-11-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0003_p2_practice"
down_revision: str | None = "0002_common_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "code_drafts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("task_id", sa.String(length=36), nullable=True),
        sa.Column("task_occurrence_id", sa.String(length=36), nullable=True),
        sa.Column("source_submission_id", sa.String(length=36), nullable=True),
        sa.Column("problem_title", sa.String(length=300), nullable=False),
        sa.Column("problem_source", sa.String(length=300), nullable=True),
        sa.Column(
            "difficulty",
            sa.String(length=16),
            server_default="unrated",
            nullable=False,
        ),
        sa.Column("tags_json", sa.JSON(), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("code_text", mysql.MEDIUMTEXT(), nullable=False),
        sa.Column("line_count", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("self_test_json", sa.JSON(), nullable=True),
        sa.Column("time_complexity", sa.String(length=64), nullable=False),
        sa.Column("space_complexity", sa.String(length=64), nullable=False),
        sa.Column("approach", sa.Text(), nullable=True),
        sa.Column(
            "is_independent",
            sa.Boolean(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("capability_codes_json", sa.JSON(), nullable=True),
        sa.Column(
            "version",
            sa.Integer(),
            server_default=sa.text("1"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("last_submission_id", sa.String(length=36), nullable=True),
        sa.Column("submitted_at", mysql.DATETIME(fsp=3), nullable=True),
        sa.Column("deleted_at", mysql.DATETIME(fsp=3), nullable=True),
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
            name="fk_code_drafts_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name="fk_code_drafts_task_id_tasks",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["task_occurrence_id"],
            ["task_occurrences.id"],
            name="fk_code_drafts_occurrence_id_occurrences",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_code_drafts"),
    )
    op.create_index(
        "idx_code_drafts_user_status",
        "code_drafts",
        ["user_id", "status", "updated_at"],
        unique=False,
    )
    op.create_index(
        "idx_code_drafts_user_task",
        "code_drafts",
        ["user_id", "task_id"],
        unique=False,
    )

    op.create_table(
        "code_submissions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("draft_id", sa.String(length=36), nullable=True),
        sa.Column("source_submission_id", sa.String(length=36), nullable=True),
        sa.Column("task_id", sa.String(length=36), nullable=True),
        sa.Column("task_occurrence_id", sa.String(length=36), nullable=True),
        sa.Column("problem_title", sa.String(length=300), nullable=False),
        sa.Column("problem_source", sa.String(length=300), nullable=True),
        sa.Column(
            "difficulty",
            sa.String(length=16),
            server_default="unrated",
            nullable=False,
        ),
        sa.Column("tags_json", sa.JSON(), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("code_text", mysql.MEDIUMTEXT(), nullable=False),
        sa.Column("line_count", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("self_test_json", sa.JSON(), nullable=True),
        sa.Column("time_complexity", sa.String(length=64), nullable=False),
        sa.Column("space_complexity", sa.String(length=64), nullable=False),
        sa.Column("approach", sa.Text(), nullable=True),
        sa.Column(
            "is_independent",
            sa.Boolean(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("capability_codes_json", sa.JSON(), nullable=True),
        sa.Column("consent_version", sa.String(length=32), nullable=False),
        sa.Column(
            "consent_scope",
            sa.String(length=64),
            server_default="ai_code_review",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default="submitted",
            nullable=False,
        ),
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
            name="fk_code_submissions_user_id_users",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["draft_id"],
            ["code_drafts.id"],
            name="fk_code_submissions_draft_id_drafts",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["tasks.id"],
            name="fk_code_submissions_task_id_tasks",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["task_occurrence_id"],
            ["task_occurrences.id"],
            name="fk_code_submissions_occurrence_id_occurrences",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_code_submissions"),
    )
    op.create_index(
        "idx_code_submissions_user_created",
        "code_submissions",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_code_submissions_user_task",
        "code_submissions",
        ["user_id", "task_id"],
        unique=False,
    )


def downgrade() -> None:
    # DROP TABLE removes its indexes and foreign keys together; dropping the
    # user_id index first fails on MySQL because it backs a foreign key.
    op.drop_table("code_submissions")
    op.drop_table("code_drafts")

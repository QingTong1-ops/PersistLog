"""common foundation

Revision ID: 0002_common_foundation
Revises: 0001_initial
Create Date: 2026-11-19
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision: str = "0002_common_foundation"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("path", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("response_json", sa.JSON(), nullable=True),
        sa.Column(
            "state",
            sa.String(length=16),
            nullable=False,
            server_default="processing",
        ),
        sa.Column("resource_type", sa.String(length=64), nullable=True),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            mysql.DATETIME(fsp=3),
            server_default=sa.text("CURRENT_TIMESTAMP(3)"),
            nullable=False,
        ),
        sa.Column("locked_until", mysql.DATETIME(fsp=3), nullable=True),
        sa.Column("expires_at", mysql.DATETIME(fsp=3), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_idempotency_records_user_id_users",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_idempotency_records"),
        sa.UniqueConstraint(
            "user_id",
            "idempotency_key",
            "method",
            "path",
            name="uk_idempotency_scope",
        ),
    )
    op.create_index(
        "ix_idempotency_records_expires_at",
        "idempotency_records",
        ["expires_at"],
        unique=False,
    )

    op.add_column("ai_runs", sa.Column("schema_version", sa.String(length=32)))
    op.add_column("ai_runs", sa.Column("consent_scope", sa.String(length=64)))
    op.add_column("ai_runs", sa.Column("validation_json", sa.JSON()))
    op.add_column(
        "ai_runs",
        sa.Column("quality_score", sa.Numeric(precision=5, scale=4)),
    )
    op.add_column("ai_runs", sa.Column("quality_json", sa.JSON()))

    op.add_column("jobs", sa.Column("stage", sa.String(length=64)))
    op.add_column("jobs", sa.Column("steps_json", sa.JSON()))
    op.add_column(
        "jobs",
        sa.Column(
            "attempt",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "max_attempts",
            sa.Integer(),
            server_default=sa.text("2"),
            nullable=False,
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "retryable",
            sa.Boolean(),
            server_default=sa.text("1"),
            nullable=False,
        ),
    )
    op.add_column("jobs", sa.Column("result_version", sa.String(length=64)))
    op.add_column("jobs", sa.Column("idempotency_key", sa.String(length=128)))
    op.add_column("jobs", sa.Column("started_at", mysql.DATETIME(fsp=3)))
    op.add_column("jobs", sa.Column("finished_at", mysql.DATETIME(fsp=3)))


def downgrade() -> None:
    op.drop_column("jobs", "finished_at")
    op.drop_column("jobs", "started_at")
    op.drop_column("jobs", "idempotency_key")
    op.drop_column("jobs", "result_version")
    op.drop_column("jobs", "retryable")
    op.drop_column("jobs", "max_attempts")
    op.drop_column("jobs", "attempt")
    op.drop_column("jobs", "steps_json")
    op.drop_column("jobs", "stage")

    op.drop_column("ai_runs", "quality_json")
    op.drop_column("ai_runs", "quality_score")
    op.drop_column("ai_runs", "validation_json")
    op.drop_column("ai_runs", "consent_scope")
    op.drop_column("ai_runs", "schema_version")

    op.drop_index("ix_idempotency_records_expires_at", table_name="idempotency_records")
    op.drop_table("idempotency_records")

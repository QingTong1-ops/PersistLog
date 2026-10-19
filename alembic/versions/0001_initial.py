"""initial Phase 1 schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-19
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "docs" / "schema.sql"

TABLES_IN_DROP_ORDER = [
    "audit_logs",
    "jobs",
    "notification_outbox",
    "notification_preferences",
    "notification_templates",
    "notification_channels",
    "import_issues",
    "import_items",
    "import_batches",
    "daily_plan_items",
    "task_occurrences",
    "daily_plans",
    "recurring_rules",
    "task_dependencies",
    "tasks",
    "route_weeks",
    "route_stages",
    "route_versions",
    "routes",
    "ai_runs",
    "files",
    "job_targets",
    "user_consents",
    "user_profiles",
    "refresh_tokens",
    "users",
]


def _statements() -> list[str]:
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    lines = [line for line in sql.splitlines() if not line.strip().startswith("--")]
    return [statement.strip() for statement in "\n".join(lines).split(";") if statement.strip()]


def upgrade() -> None:
    for statement in _statements():
        op.execute(statement)


def downgrade() -> None:
    op.execute("SET FOREIGN_KEY_CHECKS=0")
    for table in TABLES_IN_DROP_ORDER:
        op.execute(f"DROP TABLE IF EXISTS `{table}`")
    op.execute("SET FOREIGN_KEY_CHECKS=1")

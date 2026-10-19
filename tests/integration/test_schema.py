from __future__ import annotations

import pymysql
import pytest
from app.core.config import get_settings
from sqlalchemy.engine import make_url

EXPECTED_TABLES = {
    "users",
    "refresh_tokens",
    "user_profiles",
    "user_consents",
    "job_targets",
    "files",
    "ai_runs",
    "routes",
    "route_versions",
    "route_stages",
    "route_weeks",
    "tasks",
    "task_dependencies",
    "recurring_rules",
    "daily_plans",
    "task_occurrences",
    "daily_plan_items",
    "import_batches",
    "import_items",
    "import_issues",
    "notification_channels",
    "notification_templates",
    "notification_preferences",
    "notification_outbox",
    "jobs",
    "audit_logs",
}


def test_phase1_schema_tables_exist() -> None:
    settings = get_settings()
    if not settings.test_database_url:
        pytest.skip("TEST_DATABASE_URL is not configured")

    url = make_url(settings.test_database_url)
    connection = pymysql.connect(
        host=url.host or "127.0.0.1",
        port=url.port or 3306,
        user=url.username or "root",
        password=url.password or "",
        database=url.database,
        charset="utf8mb4",
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            tables = {row[0] for row in cursor.fetchall()}
    finally:
        connection.close()

    missing = EXPECTED_TABLES - tables
    assert not missing, f"missing tables: {sorted(missing)}"

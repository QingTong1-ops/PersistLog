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
    "idempotency_records",
    "code_drafts",
    "code_submissions",
    "code_evaluations",
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


def test_common_foundation_columns_exist() -> None:
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
            cursor.execute("SHOW COLUMNS FROM jobs")
            job_columns = {row[0] for row in cursor.fetchall()}
            cursor.execute("SHOW COLUMNS FROM ai_runs")
            ai_columns = {row[0] for row in cursor.fetchall()}
            cursor.execute("SHOW COLUMNS FROM idempotency_records")
            idempotency_columns = {row[0] for row in cursor.fetchall()}
            cursor.execute("SHOW COLUMNS FROM code_drafts")
            draft_columns = {row[0] for row in cursor.fetchall()}
            cursor.execute("SHOW COLUMNS FROM code_submissions")
            submission_columns = {row[0] for row in cursor.fetchall()}
            cursor.execute("SHOW COLUMNS FROM code_evaluations")
            evaluation_columns = {row[0] for row in cursor.fetchall()}
    finally:
        connection.close()

    assert {
        "stage",
        "steps_json",
        "attempt",
        "max_attempts",
        "retryable",
        "result_version",
        "idempotency_key",
        "started_at",
        "finished_at",
    } <= job_columns
    assert {
        "schema_version",
        "consent_scope",
        "validation_json",
        "quality_score",
        "quality_json",
    } <= ai_columns
    assert {
        "idempotency_key",
        "request_hash",
        "status_code",
        "response_json",
        "state",
        "locked_until",
        "expires_at",
    } <= idempotency_columns
    assert {
        "code_text",
        "line_count",
        "code_hash",
        "self_test_json",
        "version",
        "status",
    } <= draft_columns
    assert {
        "draft_id",
        "source_submission_id",
        "code_text",
        "line_count",
        "code_hash",
        "consent_version",
        "status",
        "latest_evaluation_id",
        "current_evaluation_id",
        "evaluation_count",
        "review_status",
        "latest_score",
    } <= submission_columns
    assert {
        "submission_id",
        "sequence_no",
        "status",
        "is_current",
        "score",
        "level",
        "dimensions_json",
        "evidence_json",
        "rubric_version",
        "prompt_version",
        "ai_run_id",
        "job_id",
    } <= evaluation_columns

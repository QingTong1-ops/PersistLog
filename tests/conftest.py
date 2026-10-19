import os

os.environ["APP_ENV"] = "test"

import pytest
from app.core.db import SessionLocal, engine
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import text


@pytest.fixture()
def clean_db():
    """Remove account data before and after each API test."""
    _clean_account_tables()
    yield
    _clean_account_tables()


def _clean_account_tables() -> None:
    with engine.begin() as connection:
        connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for table in (
            "daily_plan_items",
            "task_occurrences",
            "daily_plans",
            "import_issues",
            "import_items",
            "import_batches",
            "task_dependencies",
            "tasks",
            "route_weeks",
            "route_stages",
            "route_versions",
            "routes",
            "files",
            "ai_runs",
            "jobs",
            "notification_outbox",
            "notification_preferences",
            "notification_channels",
            "user_consents",
            "refresh_tokens",
            "job_targets",
            "user_profiles",
            "users",
        ):
            connection.execute(text(f"DELETE FROM {table}"))
        connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))


@pytest.fixture()
def client(clean_db):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db(clean_db):
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

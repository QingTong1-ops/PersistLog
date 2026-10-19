import os

os.environ["APP_ENV"] = "test"

import pytest
from app.core.db import engine
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
        for table in (
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
            "user_consents",
            "refresh_tokens",
            "job_targets",
            "user_profiles",
            "users",
        ):
            connection.execute(text(f"DELETE FROM {table}"))


@pytest.fixture()
def client(clean_db):
    with TestClient(app) as test_client:
        yield test_client

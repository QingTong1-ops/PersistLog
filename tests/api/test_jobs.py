from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from app.models.system import Job
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.api.test_auth import auth_header, register
from tests.api.test_imports import _upload


def test_import_job_can_be_polled(client: TestClient) -> None:
    body = register(client)
    token = body["access_token"]
    created = _upload(client, token)
    assert created.status_code == 201, created.text
    job_id = created.json()["job_id"]

    response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_header(token))
    assert response.status_code == 200, response.text
    job = response.json()
    assert job["job_type"] == "import_normalization"
    assert job["status"] == "succeeded"
    assert job["progress"] == 1.0
    assert job["result_ref"] == f"import:{created.json()['import_id']}"
    assert job["error"] is None
    assert job["attempt"] == 0
    assert job["max_attempts"] == 2
    assert job["retryable"] is True
    assert job["steps"] is None


def test_job_exposes_steps_and_retry_metadata(
    client: TestClient, db: Session
) -> None:
    body = register(client, email="job-meta@example.com")
    job = Job(
        user_id=body["user"]["id"],
        job_type="code_review",
        status="running",
        stage="reading_code",
        steps_json=[
            {
                "order": 1,
                "name": "读取代码快照",
                "status": "succeeded",
                "detail": "读取 42 行",
            }
        ],
        progress=Decimal("0.40"),
        attempt=1,
        max_attempts=3,
        retryable=True,
        result_version="2",
        started_at=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    response = client.get(
        f"/api/v1/jobs/{job.id}",
        headers=auth_header(body["access_token"]),
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["stage"] == "reading_code"
    assert data["steps"][0]["name"] == "读取代码快照"
    assert data["attempt"] == 1
    assert data["max_attempts"] == 3
    assert data["result_version"] == "2"
    assert data["started_at"].endswith("Z")
    assert data["finished_at"] is None


def test_job_is_isolated_by_user(client: TestClient) -> None:
    alice = register(client, email="alice@example.com")
    bob = register(client, email="bob@example.com")
    created = _upload(client, alice["access_token"])
    job_id = created.json()["job_id"]

    response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_header(bob["access_token"]))
    assert response.status_code == 404


def test_unknown_job_returns_404(client: TestClient) -> None:
    body = register(client)
    response = client.get(
        "/api/v1/jobs/00000000-0000-0000-0000-000000000000",
        headers=auth_header(body["access_token"]),
    )
    assert response.status_code == 404

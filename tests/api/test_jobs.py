from __future__ import annotations

from fastapi.testclient import TestClient

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

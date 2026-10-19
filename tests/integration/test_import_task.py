from __future__ import annotations

from decimal import Decimal

from app.models.import_plan import ImportBatch
from app.models.system import Job, StoredFile
from app.worker.tasks.import_tasks import process_import_task
from fastapi.testclient import TestClient
from sqlalchemy import select

from tests.api.test_auth import register
from tests.api.test_imports import _upload


def test_import_task_processes_persisted_batch(client: TestClient, db) -> None:
    body = register(client)
    token = body["access_token"]
    user_id = body["user"]["id"]

    # Upload once through the API, then reuse the stored file for a batch that
    # is processed only through the Celery task entry point.
    _upload(client, token)
    stored = db.scalar(
        select(StoredFile)
        .where(StoredFile.user_id == user_id)
        .order_by(StoredFile.created_at.desc())
    )
    assert stored is not None

    batch = ImportBatch(
        user_id=user_id,
        file_id=stored.id,
        format="markdown",
        status="parsing",
        parser_version="markdown-v1",
    )
    job = Job(
        user_id=user_id,
        job_type="import_normalization",
        status="queued",
        progress=Decimal("0.05"),
    )
    db.add(batch)
    db.add(job)
    db.commit()
    batch_id, job_id = batch.id, job.id

    result = process_import_task.apply(args=[job_id, batch_id])
    assert result.successful()

    db.expire_all()
    refreshed_batch = db.get(ImportBatch, batch_id)
    refreshed_job = db.get(Job, job_id)
    assert refreshed_batch is not None and refreshed_batch.status == "needs_review"
    assert refreshed_job is not None and refreshed_job.status == "succeeded"
    assert refreshed_job.progress == Decimal("1.00")
    assert refreshed_batch.summary_json["stats"]["tasks"] == 2


def test_import_task_skips_terminal_batch(client: TestClient, db) -> None:
    body = register(client)
    created = _upload(client, body["access_token"])
    batch = db.get(ImportBatch, created.json()["import_id"])
    job = db.get(Job, created.json()["job_id"])
    assert batch is not None and job is not None

    # The API already processed this batch in eager test mode; rerunning the
    # task must not duplicate AI runs or overwrite the terminal state.
    process_import_task.apply(args=[job.id, batch.id])

    db.expire_all()
    refreshed = db.get(ImportBatch, batch.id)
    assert refreshed is not None and refreshed.status == "needs_review"

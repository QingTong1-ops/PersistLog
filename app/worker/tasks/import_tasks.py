from __future__ import annotations

from app.core.db import SessionLocal
from app.services import import_service
from app.worker.celery_app import celery_app


@celery_app.task(name="app.worker.tasks.import_tasks.process_import")
def process_import_task(job_id: str, batch_id: str) -> None:
    db = SessionLocal()
    try:
        import_service.process_import(db, batch_id=batch_id, job_id=job_id)
    finally:
        db.close()

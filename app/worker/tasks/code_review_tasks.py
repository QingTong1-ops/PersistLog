from __future__ import annotations

from app.core.db import SessionLocal
from app.services import code_review_service
from app.worker.celery_app import celery_app


@celery_app.task(name="app.worker.tasks.code_review_tasks.process_code_review")
def process_code_review_task(job_id: str, evaluation_id: str) -> None:
    db = SessionLocal()
    try:
        code_review_service.process_evaluation(db, evaluation_id, job_id)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

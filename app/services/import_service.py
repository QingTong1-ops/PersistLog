from __future__ import annotations

import copy
import hashlib
import logging
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from fastapi import UploadFile
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from app.ai import get_plan_normalizer
from app.core.config import get_settings
from app.core.errors import AppError
from app.models.import_plan import ImportBatch, ImportIssue, ImportItem
from app.models.profile import UserProfile
from app.models.route import Route, RouteStage, RouteVersion, RouteWeek, Task
from app.models.system import AiRun, Job, StoredFile
from app.models.user import User
from app.services import file_service, job_target_service
from app.services.import_validation import validate_route_draft
from app.services.markdown_parser import parse_markdown

settings = get_settings()
logger = logging.getLogger(__name__)

TERMINAL_IMPORT_STATUSES = {
    "needs_review",
    "failed",
    "confirmed",
    "cancelled",
    "rolled_back",
}


def _capacity_minutes(db: Session, user: User) -> int:
    profile = db.get(UserProfile, user.id)
    if profile is None:
        return 96
    return max(int(profile.daily_available_minutes * float(profile.planning_capacity_factor)), 30)


def _issue_payload(issue: ImportIssue, source_locator: str | None = None) -> dict[str, Any]:
    return {
        "severity": issue.severity,
        "code": issue.code,
        "message": issue.message,
        "suggestion": issue.suggestion,
        "source_locator": source_locator,
    }


def _flatten_tasks(route: dict[str, Any]) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    for stage in route.get("stages", []):
        for week in stage.get("weeks", []):
            tasks.extend(week.get("tasks", []))
    return tasks


def _replace_items_and_issues(
    db: Session,
    batch: ImportBatch,
    route: dict[str, Any],
    issues: list[dict[str, Any]],
) -> None:
    db.execute(delete(ImportIssue).where(ImportIssue.batch_id == batch.id))
    db.execute(delete(ImportItem).where(ImportItem.batch_id == batch.id))
    locator_to_item: dict[str, str] = {}
    for task in _flatten_tasks(route):
        item = ImportItem(
            batch_id=batch.id,
            source_locator=task.get("source_locator"),
            normalized_json=task,
            status="valid",
        )
        db.add(item)
        db.flush()
        if task.get("source_locator"):
            locator_to_item[task["source_locator"]] = item.id
    for issue in issues:
        db.add(
            ImportIssue(
                batch_id=batch.id,
                item_id=locator_to_item.get(issue.get("source_locator") or ""),
                severity=issue["severity"],
                code=issue["code"],
                message=issue["message"],
                suggestion=issue.get("suggestion"),
            )
        )


def _process_import(
    db: Session,
    user: User,
    batch: ImportBatch,
    job: Job,
    stored,
) -> None:
    started = time.perf_counter()
    job.status = "running"
    job.progress = Decimal("0.15")
    db.commit()

    source_text = file_service.read_text(stored)
    rule_draft = parse_markdown(source_text)
    job.progress = Decimal("0.40")
    db.commit()

    normalizer = get_plan_normalizer(settings.ai_provider)
    ai_status = "succeeded"
    ai_error_code: str | None = None
    ai_error_detail: str | None = None
    try:
        draft = normalizer.normalize_plan(source_text, rule_draft)
    except Exception as exc:  # noqa: BLE001
        # AI is an enhancement: keep the import usable with the rule parser.
        logger.warning("AI normalization failed, falling back to rules", exc_info=True)
        draft = copy.deepcopy(rule_draft)
        draft.setdefault("assumptions", []).append("AI 解析失败，已使用规则解析结果")
        draft.setdefault("warnings", []).append("AI 解析失败，请检查计划格式和字段")
        ai_status = "failed"
        ai_error_code = getattr(exc, "code", "AI_PROVIDER_ERROR")
        ai_error_detail = str(exc)[:1000]
    job.progress = Decimal("0.65")
    db.commit()

    capacity = _capacity_minutes(db, user)
    draft, issues, stats = validate_route_draft(
        draft,
        daily_capacity_minutes=capacity,
    )
    has_errors = any(issue["severity"] == "error" for issue in issues)
    job.progress = Decimal("0.85")
    db.commit()

    ai_run = AiRun(
        user_id=user.id,
        run_type="plan_import_normalization",
        provider=normalizer.name,
        model=settings.ai_model or "stub",
        prompt_version="import-markdown-v1",
        input_hash=hashlib.sha256(source_text.encode("utf-8")).hexdigest(),
        input_snapshot_json={
            "filename": stored.original_name,
            "characters": len(source_text),
        },
        output_json=draft["route"],
        status=ai_status,
        error_code=ai_error_code,
        error_detail=ai_error_detail,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    db.add(ai_run)
    db.flush()

    batch.ai_run_id = ai_run.id
    batch.summary_json = {
        "route": draft["route"],
        "assumptions": draft.get("assumptions", []),
        "warnings": draft.get("warnings", []),
        "stats": stats,
    }
    batch.error_json = {"issues": issues} if has_errors else None
    batch.status = "failed" if has_errors else "needs_review"
    job.status = "failed" if has_errors else "succeeded"
    job.progress = Decimal("1.00")
    job.result_ref = f"import:{batch.id}"
    if has_errors:
        job.error_json = {"code": "IMPORT_VALIDATION_FAILED", "issue_count": len(issues)}

    _replace_items_and_issues(db, batch, draft["route"], issues)
    db.commit()
    db.refresh(batch)
    db.refresh(job)


def _mark_import_failed(
    db: Session,
    batch: ImportBatch,
    job: Job,
    *,
    code: str,
    message: str,
) -> None:
    batch.status = "failed"
    batch.error_json = {"code": code, "message": message}
    job.status = "failed"
    job.progress = Decimal("1.00")
    job.error_json = {"code": code, "message": message}
    db.commit()


def process_import(db: Session, batch_id: str, job_id: str) -> None:
    """Run the import pipeline for an already persisted batch and job."""
    batch = db.get(ImportBatch, batch_id)
    job = db.get(Job, job_id)
    if batch is None or job is None:
        return
    if batch.status in TERMINAL_IMPORT_STATUSES:
        return

    user = db.get(User, batch.user_id)
    stored = db.get(StoredFile, batch.file_id)
    if user is None or stored is None:
        _mark_import_failed(
            db,
            batch,
            job,
            code="IMPORT_NOT_FOUND",
            message="导入文件或用户不存在",
        )
        return

    try:
        _process_import(db, user, batch, job, stored)
    except AppError as exc:
        db.rollback()
        batch = db.get(ImportBatch, batch_id)
        job = db.get(Job, job_id)
        if batch is not None and job is not None:
            _mark_import_failed(db, batch, job, code=exc.code, message=exc.message)
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("import %s failed", batch_id)
        batch = db.get(ImportBatch, batch_id)
        job = db.get(Job, job_id)
        if batch is not None and job is not None:
            _mark_import_failed(
                db,
                batch,
                job,
                code="IMPORT_FAILED",
                message="导入处理失败",
            )
        raise AppError("IMPORT_FAILED", "导入处理失败", status_code=500) from exc


def _broker_available() -> bool:
    """Check Redis quickly so a missing broker cannot stall the request."""
    try:
        client = Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        return bool(client.ping())
    except (RedisError, OSError):
        return False


def create_import(
    db: Session, user: User, upload: UploadFile
) -> tuple[ImportBatch, Job]:
    stored = file_service.save_import_upload(db, user, upload)
    batch = ImportBatch(
        user_id=user.id,
        file_id=stored.id,
        format="markdown",
        status="parsing",
        parser_version="markdown-v1",
    )
    job = Job(
        user_id=user.id,
        job_type="import_normalization",
        status="queued",
        progress=Decimal("0.05"),
    )
    db.add(batch)
    db.add(job)
    db.commit()
    db.refresh(batch)
    db.refresh(job)

    from app.worker.celery_app import celery_app

    # Fall back to in-process execution when the broker is unavailable, so
    # local development still works without a running Redis/worker.
    if celery_app.conf.task_always_eager or not _broker_available():
        process_import(db, batch.id, job.id)
    else:
        from app.worker.tasks import import_tasks

        try:
            import_tasks.process_import_task.delay(job.id, batch.id)
        except Exception:  # noqa: BLE001
            logger.warning("import broker unavailable, processing inline", exc_info=True)
            process_import(db, batch.id, job.id)

    db.refresh(batch)
    db.refresh(job)
    return batch, job


def list_imports(db: Session, user: User) -> list[ImportBatch]:
    statement = (
        select(ImportBatch)
        .where(ImportBatch.user_id == user.id)
        .order_by(ImportBatch.created_at.desc())
    )
    return list(db.scalars(statement))


def get_batch(db: Session, user: User, batch_id: str) -> ImportBatch:
    batch = db.scalar(
        select(ImportBatch).where(
            ImportBatch.id == batch_id,
            ImportBatch.user_id == user.id,
        )
    )
    if batch is None:
        raise AppError("IMPORT_NOT_FOUND", "导入记录不存在", status_code=404)
    return batch


def get_issues(db: Session, batch: ImportBatch) -> list[dict[str, Any]]:
    rows = list(
        db.scalars(
            select(ImportIssue)
            .where(ImportIssue.batch_id == batch.id)
            .order_by(ImportIssue.created_at, ImportIssue.id)
        )
    )
    item_ids = [row.item_id for row in rows if row.item_id]
    item_map: dict[str, str | None] = {}
    if item_ids:
        items = list(db.scalars(select(ImportItem).where(ImportItem.id.in_(item_ids))))
        item_map = {item.id: item.source_locator for item in items}
    result = []
    for row in rows:
        payload = _issue_payload(row, item_map.get(row.item_id) if row.item_id else None)
        result.append(payload)
    return result


def get_preview(db: Session, user: User, batch_id: str) -> dict[str, Any]:
    batch = get_batch(db, user, batch_id)
    summary = batch.summary_json or {}
    return {
        "import_id": batch.id,
        "status": batch.status,
        "route": summary.get("route"),
        "assumptions": summary.get("assumptions", []),
        "warnings": summary.get("warnings", []),
        "stats": summary.get("stats", {}),
        "issues": get_issues(db, batch),
        "updated_at": batch.updated_at,
    }


def get_detail(db: Session, user: User, batch_id: str) -> dict[str, Any]:
    batch = get_batch(db, user, batch_id)
    summary = batch.summary_json or {}
    stored = db.get(StoredFile, batch.file_id)
    return {
        "import_id": batch.id,
        "status": batch.status,
        "format": batch.format,
        "file_name": stored.original_name if stored else None,
        "route_id": batch.created_route_id,
        "route": summary.get("route"),
        "assumptions": summary.get("assumptions", []),
        "warnings": summary.get("warnings", []),
        "stats": summary.get("stats", {}),
        "issues": get_issues(db, batch),
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
    }


def update_preview(
    db: Session, user: User, batch_id: str, route: dict[str, Any]
) -> dict[str, Any]:
    batch = get_batch(db, user, batch_id)
    if batch.status not in {"needs_review", "failed"}:
        raise AppError("IMPORT_INVALID_STATE", "当前导入状态不可编辑", status_code=409)

    draft = {"route": route, "assumptions": (batch.summary_json or {}).get("assumptions", [])}
    capacity = _capacity_minutes(db, user)
    draft, issues, stats = validate_route_draft(
        draft,
        daily_capacity_minutes=capacity,
    )
    has_errors = any(issue["severity"] == "error" for issue in issues)
    batch.summary_json = {
        "route": draft["route"],
        "assumptions": draft.get("assumptions", []),
        "warnings": (batch.summary_json or {}).get("warnings", []),
        "stats": stats,
    }
    batch.error_json = {"issues": issues} if has_errors else None
    batch.status = "failed" if has_errors else "needs_review"
    _replace_items_and_issues(db, batch, draft["route"], issues)
    db.commit()
    db.refresh(batch)
    return get_preview(db, user, batch.id)


def _date(value: Any, fallback: date) -> date:
    if isinstance(value, date):
        return value
    if value:
        try:
            return date.fromisoformat(str(value)[:10])
        except ValueError:
            pass
    return fallback


def confirm_import(db: Session, user: User, batch_id: str) -> tuple[str, int]:
    batch = get_batch(db, user, batch_id)
    if batch.status == "confirmed" and batch.created_route_id:
        count = db.scalar(select(func.count(Task.id)).where(Task.route_id == batch.created_route_id))
        return batch.created_route_id, int(count or 0)
    if batch.status != "needs_review":
        raise AppError("IMPORT_INVALID_STATE", "当前导入状态不可确认", status_code=409)

    issues = get_issues(db, batch)
    if any(issue["severity"] == "error" for issue in issues):
        raise AppError("IMPORT_VALIDATION_FAILED", "导入仍有错误，不能确认", status_code=422)

    route_draft = (batch.summary_json or {}).get("route")
    if not route_draft:
        raise AppError("IMPORT_VALIDATION_FAILED", "缺少路线草案", status_code=422)

    target = job_target_service.resolve_default(db, user)
    capacity = _capacity_minutes(db, user)
    start = _date(route_draft.get("start_date"), date.today())
    end = _date(route_draft.get("end_date"), start + timedelta(days=30))
    if end < start:
        end = start + timedelta(days=30)

    route = Route(
        user_id=user.id,
        job_target_id=target.id,
        title=str(route_draft.get("title") or "导入计划"),
        description=None,
        status="active",
        source_type="imported",
        source_id=batch.id,
        start_date=start,
        end_date=end,
        daily_capacity_minutes=capacity,
        forecast_end_date=end,
        current_version=1,
    )
    db.add(route)
    db.flush()

    db.add(
        RouteVersion(
            route_id=route.id,
            version_no=1,
            snapshot_json=route_draft,
            change_type="import",
            change_summary=f"从导入批次 {batch.id} 创建",
            created_by=user.id,
        )
    )

    created_tasks = 0
    for stage_index, stage_draft in enumerate(route_draft.get("stages", []), start=1):
        stage_start = _date(stage_draft.get("start_date"), start)
        stage_end = _date(stage_draft.get("end_date"), end)
        stage = RouteStage(
            route_id=route.id,
            name=str(stage_draft.get("name") or f"阶段 {stage_index}"),
            objective=str(stage_draft.get("objective") or ""),
            order_no=stage_index,
            start_date=stage_start,
            end_date=stage_end,
            weight=Decimal("1.00"),
            exit_criteria=None,
        )
        db.add(stage)
        db.flush()

        for week_draft in stage_draft.get("weeks", []):
            week = RouteWeek(
                stage_id=stage.id,
                week_no=int(week_draft.get("week_no") or 1),
                focus=str(week_draft.get("focus") or ""),
                milestone=str(week_draft.get("milestone") or ""),
                start_date=_date(week_draft.get("start_date"), stage_start),
                end_date=_date(week_draft.get("end_date"), stage_end),
            )
            db.add(week)
            db.flush()

            for task_draft in week_draft.get("tasks", []):
                planned = _date(task_draft.get("planned_date"), start)
                task = Task(
                    user_id=user.id,
                    route_id=route.id,
                    stage_id=stage.id,
                    week_id=week.id,
                    title=str(task_draft.get("title") or "未命名任务"),
                    description=str(task_draft.get("description") or ""),
                    learning_objective=str(task_draft.get("learning_objective") or ""),
                    task_type=str(task_draft.get("task_type") or "fundamentals"),
                    priority=str(task_draft.get("priority") or "P1"),
                    estimated_minutes=int(task_draft.get("estimated_minutes") or 45),
                    planned_date=planned,
                    due_date=None,
                    deliverable=str(task_draft.get("deliverable") or "待补充"),
                    acceptance_criteria=str(task_draft.get("acceptance_criteria") or "待补充"),
                    resources_json=task_draft.get("resources") or [],
                    capability_tags_json=task_draft.get("capability_tags") or [],
                    needs_review=False,
                    is_splittable=True,
                    source_type="imported",
                    source_id=batch.id,
                    status="active",
                )
                db.add(task)
                created_tasks += 1

    batch.created_route_id = route.id
    batch.status = "confirmed"
    db.commit()
    db.refresh(route)
    return route.id, created_tasks


def cancel_import(db: Session, user: User, batch_id: str) -> None:
    batch = get_batch(db, user, batch_id)
    if batch.status not in {"uploaded", "parsing", "needs_review", "failed"}:
        raise AppError("IMPORT_INVALID_STATE", "当前导入状态不可取消", status_code=409)
    batch.status = "cancelled"
    db.commit()


def rollback_import(db: Session, user: User, batch_id: str) -> None:
    batch = get_batch(db, user, batch_id)
    if batch.status != "confirmed" or not batch.created_route_id:
        raise AppError("IMPORT_INVALID_STATE", "当前导入状态不可回滚", status_code=409)

    occurrence_count = db.scalar(
        text(
            "SELECT COUNT(*) FROM task_occurrences "
            "WHERE task_id IN (SELECT id FROM tasks WHERE route_id = :route_id)"
        ),
        {"route_id": batch.created_route_id},
    )
    if occurrence_count:
        raise AppError(
            "IMPORT_ROLLBACK_NOT_ALLOWED",
            "路线已经产生执行记录，不能回滚",
            status_code=409,
        )

    route = db.get(Route, batch.created_route_id)
    if route is not None:
        route.status = "archived"
        db.execute(
            update(Task)
            .where(Task.route_id == route.id)
            .values(status="archived")
        )
    batch.status = "rolled_back"
    db.commit()

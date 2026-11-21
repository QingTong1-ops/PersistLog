from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.versioning import ensure_version, resolve_expected_version
from app.models.planning import TaskOccurrence
from app.models.practice import CodeDraft, CodeSubmission
from app.models.route import Route, RouteStage, RouteWeek, Task
from app.models.user import User
from app.schemas.practice import (
    CodeInput,
    PracticeContextOut,
    PracticeDraftCreate,
    PracticeDraftOut,
    PracticeDraftSubmit,
    PracticeDraftSummary,
    PracticeDraftUpdate,
    PracticeSubmissionCreate,
    PracticeSubmissionOut,
    PracticeSubmissionSummary,
    PracticeTaskContext,
    SelfTest,
)
from app.services import consent_service

logger = logging.getLogger(__name__)

MAX_CODE_BYTES = 200 * 1024

LANGUAGE_EXTENSIONS: dict[str, tuple[str, ...]] = {
    "python": (".py",),
    "java": (".java",),
    "javascript": (".js", ".jsx"),
    "typescript": (".ts", ".tsx"),
}
DEFAULT_FILE_NAMES: dict[str, str] = {
    "python": "solution.py",
    "java": "Solution.java",
    "javascript": "solution.js",
    "typescript": "solution.ts",
}


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _normalize_file_name(language: str, file_name: str | None) -> str:
    cleaned = (file_name or "").strip()
    if not cleaned:
        cleaned = DEFAULT_FILE_NAMES[language]
    if len(cleaned) > 255:
        raise AppError(
            "INVALID_FILE_NAME",
            "文件名不能超过 255 个字符",
            status_code=422,
        )
    if "/" in cleaned or "\\" in cleaned or cleaned in {".", ".."}:
        raise AppError(
            "INVALID_FILE_NAME",
            "文件名不能包含路径",
            status_code=422,
        )
    allowed = LANGUAGE_EXTENSIONS[language]
    if not cleaned.lower().endswith(allowed):
        raise AppError(
            "INVALID_FILE_NAME",
            f"{language} 只允许文件扩展名 {', '.join(allowed)}",
            status_code=422,
        )
    return cleaned


def _code_snapshot(language: str, code_text: str) -> tuple[int, str]:
    del language
    if not code_text.strip():
        raise AppError("EMPTY_CODE", "代码不能为空", status_code=422)
    if len(code_text.encode("utf-8")) > MAX_CODE_BYTES:
        raise AppError(
            "CODE_TOO_LARGE",
            "代码不能超过 200 KiB",
            status_code=413,
        )
    line_count = code_text.count("\n") + 1
    code_hash = hashlib.sha256(code_text.encode("utf-8")).hexdigest()
    return line_count, code_hash


def _self_test_json(payload: CodeInput | PracticeDraftCreate) -> dict | None:
    if payload.self_test is None or not payload.self_test.provided:
        return None
    return payload.self_test.model_dump(mode="json")


def _self_test_out(value: dict | None) -> SelfTest | None:
    return SelfTest.model_validate(value) if value else None


def _load_task(
    db: Session,
    user: User,
    task_id: str | None,
    occurrence_id: str | None,
    *,
    strict: bool = True,
) -> Task | None:
    occurrence: TaskOccurrence | None = None
    task: Task | None = None

    if occurrence_id:
        occurrence = db.scalar(
            select(TaskOccurrence).where(
                TaskOccurrence.id == occurrence_id,
                TaskOccurrence.user_id == user.id,
            )
        )
        if occurrence is None:
            if not strict:
                return None
            raise AppError("OCCURRENCE_NOT_FOUND", "任务实例不存在", status_code=404)

    if task_id:
        task = db.scalar(
            select(Task).where(
                Task.id == task_id,
                Task.user_id == user.id,
                Task.deleted_at.is_(None),
            )
        )
        if task is None:
            if not strict:
                return None
            raise AppError("TASK_NOT_FOUND", "任务不存在", status_code=404)

    if occurrence is not None:
        if task is not None and task.id != occurrence.task_id:
            raise AppError(
                "PRACTICE_TASK_MISMATCH",
                "任务与任务实例不匹配",
                status_code=422,
            )
        if task is None:
            task = db.scalar(
                select(Task).where(
                    Task.id == occurrence.task_id,
                    Task.user_id == user.id,
                    Task.deleted_at.is_(None),
                )
            )
            if task is None:
                if not strict:
                    return None
                raise AppError("TASK_NOT_FOUND", "任务不存在", status_code=404)

    return task


def _task_context(
    db: Session,
    user: User,
    task_id: str | None,
    occurrence_id: str | None,
    *,
    strict: bool = True,
) -> PracticeTaskContext | None:
    task = _load_task(db, user, task_id, occurrence_id, strict=strict)
    if task is None:
        return None

    route = None
    if task.route_id is not None:
        route = db.scalar(
            select(Route).where(
                Route.id == task.route_id,
                Route.user_id == user.id,
                Route.deleted_at.is_(None),
            )
        )
        if route is None and strict:
            raise AppError("ROUTE_NOT_FOUND", "任务所属路线不存在", status_code=404)

    stage = None
    if task.stage_id is not None:
        stage = db.scalar(
            select(RouteStage).where(RouteStage.id == task.stage_id)
        )
    week = None
    if task.week_id is not None:
        week = db.scalar(select(RouteWeek).where(RouteWeek.id == task.week_id))

    return PracticeTaskContext(
        task_id=task.id,
        occurrence_id=occurrence_id,
        title=task.title,
        task_type=task.task_type,
        route_id=route.id if route else task.route_id,
        route_title=route.title if route else None,
        stage_id=stage.id if stage else task.stage_id,
        stage_name=stage.name if stage else None,
        week_id=week.id if week else task.week_id,
        week_focus=week.focus if week else None,
        estimated_minutes=task.estimated_minutes,
        deliverable=task.deliverable,
        acceptance_criteria=task.acceptance_criteria,
        capability_codes=list(task.capability_tags_json or []),
    )


def get_context(
    db: Session,
    user: User,
    task_id: str | None = None,
    occurrence_id: str | None = None,
) -> PracticeContextOut:
    context = _task_context(
        db,
        user,
        task_id,
        occurrence_id,
        strict=bool(task_id or occurrence_id),
    )
    return PracticeContextOut(task_context=context)


def _resolve_links(
    db: Session,
    user: User,
    payload: CodeInput,
    *,
    strict: bool = True,
) -> tuple[str | None, str | None, list[str], PracticeTaskContext | None]:
    context = _task_context(
        db,
        user,
        payload.task_id,
        payload.task_occurrence_id,
        strict=strict,
    )
    capability_codes = list(payload.capability_codes)
    if not capability_codes and context is not None:
        capability_codes = list(context.capability_codes)
    return (
        context.task_id if context else payload.task_id,
        context.occurrence_id if context else payload.task_occurrence_id,
        capability_codes,
        context,
    )


def _draft_or_404(db: Session, user: User, draft_id: str) -> CodeDraft:
    draft = db.scalar(
        select(CodeDraft).where(
            CodeDraft.id == draft_id,
            CodeDraft.user_id == user.id,
            CodeDraft.deleted_at.is_(None),
            CodeDraft.status != "deleted",
        )
    )
    if draft is None:
        raise AppError("DRAFT_NOT_FOUND", "草稿不存在", status_code=404)
    return draft


def _submission_or_404(
    db: Session, user: User, submission_id: str
) -> CodeSubmission:
    submission = db.scalar(
        select(CodeSubmission).where(
            CodeSubmission.id == submission_id,
            CodeSubmission.user_id == user.id,
        )
    )
    if submission is None:
        raise AppError("SUBMISSION_NOT_FOUND", "代码提交不存在", status_code=404)
    return submission


def _draft_summary(
    db: Session, user: User, draft: CodeDraft
) -> PracticeDraftSummary:
    context = _task_context(
        db,
        user,
        draft.task_id,
        draft.task_occurrence_id,
        strict=False,
    )
    return PracticeDraftSummary(
        id=draft.id,
        problem_title=draft.problem_title,
        language=draft.language,
        version=draft.version,
        status=draft.status,
        source_submission_id=draft.source_submission_id,
        task_context=context,
        updated_at=draft.updated_at,
    )


def _draft_out(db: Session, user: User, draft: CodeDraft) -> PracticeDraftOut:
    return PracticeDraftOut(
        **_draft_summary(db, user, draft).model_dump(),
        problem_source=draft.problem_source,
        difficulty=draft.difficulty,
        tags=list(draft.tags_json or []),
        file_name=draft.file_name,
        code_text=draft.code_text,
        line_count=draft.line_count,
        code_hash=draft.code_hash,
        self_test=_self_test_out(draft.self_test_json),
        time_complexity=draft.time_complexity,
        space_complexity=draft.space_complexity,
        approach=draft.approach,
        is_independent=draft.is_independent,
        capability_codes=list(draft.capability_codes_json or []),
        task_id=draft.task_id,
        task_occurrence_id=draft.task_occurrence_id,
        last_submission_id=draft.last_submission_id,
        created_at=draft.created_at,
    )


def _submission_summary(submission: CodeSubmission) -> PracticeSubmissionSummary:
    return PracticeSubmissionSummary(
        id=submission.id,
        problem_title=submission.problem_title,
        language=submission.language,
        difficulty=submission.difficulty,
        task_id=submission.task_id,
        code_hash=submission.code_hash,
        line_count=submission.line_count,
        review_status=submission.review_status,
        evaluation_count=submission.evaluation_count,
        latest_evaluation_id=submission.latest_evaluation_id,
        latest_job_id=submission.latest_job_id,
        current_evaluation_id=submission.current_evaluation_id,
        latest_score=submission.latest_score,
        created_at=submission.created_at,
    )


def _submission_out(
    db: Session, user: User, submission: CodeSubmission
) -> PracticeSubmissionOut:
    context = _task_context(
        db,
        user,
        submission.task_id,
        submission.task_occurrence_id,
        strict=False,
    )
    return PracticeSubmissionOut(
        **_submission_summary(submission).model_dump(),
        draft_id=submission.draft_id,
        source_submission_id=submission.source_submission_id,
        task_occurrence_id=submission.task_occurrence_id,
        problem_source=submission.problem_source,
        tags=list(submission.tags_json or []),
        file_name=submission.file_name,
        code_text=submission.code_text,
        self_test=_self_test_out(submission.self_test_json),
        time_complexity=submission.time_complexity,
        space_complexity=submission.space_complexity,
        approach=submission.approach,
        is_independent=submission.is_independent,
        capability_codes=list(submission.capability_codes_json or []),
        consent_version=submission.consent_version,
        consent_scope=submission.consent_scope,
        task_context=context,
    )


def create_draft(
    db: Session,
    user: User,
    payload: PracticeDraftCreate,
) -> PracticeDraftOut:
    task_id, occurrence_id, capability_codes, _context = _resolve_links(
        db, user, payload
    )
    line_count, code_hash = _code_snapshot(payload.language, payload.code_text)
    file_name = _normalize_file_name(payload.language, payload.file_name)
    draft = CodeDraft(
        user_id=user.id,
        task_id=task_id,
        task_occurrence_id=occurrence_id,
        problem_title=payload.problem_title,
        problem_source=payload.problem_source,
        difficulty=payload.difficulty,
        tags_json=list(payload.tags),
        language=payload.language,
        file_name=file_name,
        code_text=payload.code_text,
        line_count=line_count,
        code_hash=code_hash,
        self_test_json=_self_test_json(payload),
        time_complexity=payload.time_complexity,
        space_complexity=payload.space_complexity,
        approach=payload.approach,
        is_independent=payload.is_independent,
        capability_codes_json=capability_codes,
        version=1,
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _draft_out(db, user, draft)


def get_draft(db: Session, user: User, draft_id: str) -> PracticeDraftOut:
    return _draft_out(db, user, _draft_or_404(db, user, draft_id))


def list_drafts(
    db: Session,
    user: User,
    *,
    limit: int,
    offset: int,
    task_id: str | None = None,
) -> tuple[list[PracticeDraftSummary], int]:
    conditions = [
        CodeDraft.user_id == user.id,
        CodeDraft.deleted_at.is_(None),
        CodeDraft.status == "draft",
    ]
    if task_id:
        conditions.append(CodeDraft.task_id == task_id)
    total = int(
        db.scalar(select(func.count()).select_from(CodeDraft).where(*conditions)) or 0
    )
    drafts = list(
        db.scalars(
            select(CodeDraft)
            .where(*conditions)
            .order_by(CodeDraft.updated_at.desc(), CodeDraft.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return [_draft_summary(db, user, draft) for draft in drafts], total


def update_draft(
    db: Session,
    user: User,
    draft_id: str,
    payload: PracticeDraftUpdate,
    *,
    if_match: str | None = None,
) -> PracticeDraftOut:
    draft = _draft_or_404(db, user, draft_id)
    if draft.status != "draft":
        raise AppError(
            "DRAFT_ALREADY_SUBMITTED",
            "已提交的草稿不能修改",
            status_code=409,
        )
    expected = resolve_expected_version(if_match, payload.version)
    ensure_version(draft.version, expected)

    updates = payload.model_dump(exclude_unset=True, exclude={"version"})
    required_fields = {
        "problem_title",
        "difficulty",
        "language",
        "code_text",
        "time_complexity",
        "space_complexity",
        "is_independent",
    }
    null_required = sorted(
        field for field in required_fields if field in updates and updates[field] is None
    )
    if null_required:
        raise AppError(
            "VALIDATION_ERROR",
            "必填字段不能为 null",
            status_code=422,
            details={"fields": null_required},
        )
    language = updates.get("language", draft.language)
    code_text = updates.get("code_text", draft.code_text)
    file_name = _normalize_file_name(language, updates.get("file_name", draft.file_name))
    line_count, code_hash = _code_snapshot(language, code_text)

    task_id = updates.get("task_id", draft.task_id)
    occurrence_id = updates.get("task_occurrence_id", draft.task_occurrence_id)
    if "task_occurrence_id" in updates and "task_id" not in updates:
        task_id = None
    if "task_id" in updates and "task_occurrence_id" not in updates:
        occurrence_id = None
    if "task_id" in updates or "task_occurrence_id" in updates:
        links = CodeInput(
            problem_title=updates.get("problem_title", draft.problem_title),
            problem_source=updates.get("problem_source", draft.problem_source),
            difficulty=updates.get("difficulty", draft.difficulty),
            tags=updates.get("tags", list(draft.tags_json or [])),
            language=language,
            file_name=file_name,
            code_text=code_text,
            self_test=updates.get("self_test", _self_test_out(draft.self_test_json)),
            time_complexity=updates.get(
                "time_complexity", draft.time_complexity
            ),
            space_complexity=updates.get(
                "space_complexity", draft.space_complexity
            ),
            approach=updates.get("approach", draft.approach),
            is_independent=updates.get("is_independent", draft.is_independent),
            capability_codes=updates.get(
                "capability_codes", list(draft.capability_codes_json or [])
            ),
            task_id=task_id,
            task_occurrence_id=occurrence_id,
        )
        task_id, occurrence_id, capability_codes, _ = _resolve_links(
            db, user, links
        )
        draft.capability_codes_json = capability_codes
        draft.task_id = task_id
        draft.task_occurrence_id = occurrence_id
    elif "capability_codes" in updates:
        draft.capability_codes_json = list(updates["capability_codes"] or [])

    for field in (
        "problem_title",
        "problem_source",
        "difficulty",
        "language",
        "file_name",
        "code_text",
        "time_complexity",
        "space_complexity",
        "approach",
        "is_independent",
    ):
        if field in updates:
            setattr(draft, field, updates[field])
    if "tags" in updates:
        draft.tags_json = list(updates["tags"] or [])
    if "self_test" in updates:
        self_test = payload.self_test
        draft.self_test_json = (
            self_test.model_dump(mode="json")
            if self_test is not None and self_test.provided
            else None
        )
    draft.file_name = file_name
    draft.line_count = line_count
    draft.code_hash = code_hash
    draft.version += 1
    db.commit()
    db.refresh(draft)
    return _draft_out(db, user, draft)


def delete_draft(
    db: Session,
    user: User,
    draft_id: str,
    *,
    version: int,
    if_match: str | None = None,
) -> None:
    draft = _draft_or_404(db, user, draft_id)
    expected = resolve_expected_version(if_match, version)
    ensure_version(draft.version, expected)
    draft.status = "deleted"
    draft.deleted_at = _naive_utcnow()
    draft.version += 1
    db.commit()


def _create_submission(
    db: Session,
    user: User,
    *,
    payload: CodeInput,
    draft: CodeDraft | None = None,
) -> PracticeSubmissionOut:
    consent = consent_service.require_consent(db, user, "ai_code_review")
    task_id, occurrence_id, capability_codes, _ = _resolve_links(
        db, user, payload
    )
    line_count, code_hash = _code_snapshot(payload.language, payload.code_text)
    file_name = _normalize_file_name(payload.language, payload.file_name)
    submission = CodeSubmission(
        user_id=user.id,
        draft_id=draft.id if draft else None,
        source_submission_id=draft.source_submission_id if draft else None,
        task_id=task_id,
        task_occurrence_id=occurrence_id,
        problem_title=payload.problem_title,
        problem_source=payload.problem_source,
        difficulty=payload.difficulty,
        tags_json=list(payload.tags),
        language=payload.language,
        file_name=file_name,
        code_text=payload.code_text,
        line_count=line_count,
        code_hash=code_hash,
        self_test_json=_self_test_json(payload),
        time_complexity=payload.time_complexity,
        space_complexity=payload.space_complexity,
        approach=payload.approach,
        is_independent=payload.is_independent,
        capability_codes_json=capability_codes,
        consent_version=consent.version,
        consent_scope="ai_code_review",
        status="submitted",
    )
    db.add(submission)
    if draft is not None:
        draft.status = "submitted"
        draft.submitted_at = _naive_utcnow()
    db.flush()
    if draft is not None:
        draft.last_submission_id = submission.id
        draft.version += 1
    db.commit()
    db.refresh(submission)

    # Submission creation and the first review are separate transactions so a
    # broker/worker problem never loses the immutable submission.
    from app.services import code_review_service

    try:
        code_review_service.start_evaluation(db, user, submission.id)
    except AppError:
        logger.exception("failed to start code review for submission %s", submission.id)
        submission.review_status = "failed"
        db.commit()
    db.refresh(submission)
    return _submission_out(db, user, submission)


def submit_draft(
    db: Session,
    user: User,
    draft_id: str,
    payload: PracticeDraftSubmit,
    *,
    if_match: str | None = None,
) -> PracticeSubmissionOut:
    draft = _draft_or_404(db, user, draft_id)
    if draft.status != "draft":
        raise AppError(
            "DRAFT_ALREADY_SUBMITTED",
            "该草稿已提交",
            status_code=409,
        )
    expected = resolve_expected_version(if_match, payload.version)
    ensure_version(draft.version, expected)
    if draft.task_id is not None:
        _task_context(
            db,
            user,
            draft.task_id,
            draft.task_occurrence_id,
            strict=True,
        )
    draft_payload = PracticeDraftCreate(
        problem_title=draft.problem_title,
        problem_source=draft.problem_source,
        difficulty=draft.difficulty,
        tags=list(draft.tags_json or []),
        language=draft.language,
        file_name=draft.file_name,
        code_text=draft.code_text,
        self_test=_self_test_out(draft.self_test_json),
        time_complexity=draft.time_complexity,
        space_complexity=draft.space_complexity,
        approach=draft.approach,
        is_independent=draft.is_independent,
        capability_codes=list(draft.capability_codes_json or []),
        task_id=draft.task_id,
        task_occurrence_id=draft.task_occurrence_id,
    )
    return _create_submission(db, user, payload=draft_payload, draft=draft)


def create_submission(
    db: Session,
    user: User,
    payload: PracticeSubmissionCreate,
) -> PracticeSubmissionOut:
    return _create_submission(db, user, payload=payload)


def get_submission(
    db: Session, user: User, submission_id: str
) -> PracticeSubmissionOut:
    return _submission_out(db, user, _submission_or_404(db, user, submission_id))


def list_submissions(
    db: Session,
    user: User,
    *,
    limit: int,
    offset: int,
    task_id: str | None = None,
    language: str | None = None,
) -> tuple[list[PracticeSubmissionSummary], int]:
    conditions = [CodeSubmission.user_id == user.id]
    if task_id:
        conditions.append(CodeSubmission.task_id == task_id)
    if language:
        conditions.append(CodeSubmission.language == language)
    total = int(
        db.scalar(select(func.count()).select_from(CodeSubmission).where(*conditions))
        or 0
    )
    submissions = list(
        db.scalars(
            select(CodeSubmission)
            .where(*conditions)
            .order_by(CodeSubmission.created_at.desc(), CodeSubmission.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return [_submission_summary(item) for item in submissions], total


def copy_submission_to_draft(
    db: Session, user: User, submission_id: str
) -> PracticeDraftOut:
    submission = _submission_or_404(db, user, submission_id)
    draft = CodeDraft(
        user_id=user.id,
        task_id=submission.task_id,
        task_occurrence_id=submission.task_occurrence_id,
        source_submission_id=submission.id,
        problem_title=submission.problem_title,
        problem_source=submission.problem_source,
        difficulty=submission.difficulty,
        tags_json=list(submission.tags_json or []),
        language=submission.language,
        file_name=submission.file_name,
        code_text=submission.code_text,
        line_count=submission.line_count,
        code_hash=submission.code_hash,
        self_test_json=submission.self_test_json,
        time_complexity=submission.time_complexity,
        space_complexity=submission.space_complexity,
        approach=submission.approach,
        is_independent=submission.is_independent,
        capability_codes_json=list(submission.capability_codes_json or []),
        version=1,
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _draft_out(db, user, draft)

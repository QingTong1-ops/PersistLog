from __future__ import annotations

import copy
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.ai.harness import AIGateway
from app.ai.tasks.code_review import (
    CODE_REVIEW_PROMPT_VERSION,
    CODE_REVIEW_RUBRIC_VERSION,
    CodeReviewOutput,
    build_code_review_spec,
    get_code_review_provider,
)
from app.core.errors import AppError
from app.models.practice import CodeEvaluation, CodeSubmission
from app.models.system import Job
from app.models.user import User
from app.schemas.practice import (
    CodeEvaluationOut,
    CodeEvaluationSummary,
    EvaluationStart,
)
from app.services import consent_service

logger = logging.getLogger(__name__)

DIMENSION_WEIGHTS = {
    "correctness_risk": 0.35,
    "complexity": 0.20,
    "quality": 0.20,
    "testing": 0.15,
    "communication": 0.10,
}
TERMINAL_EVALUATION_STATUSES = {
    "succeeded",
    "not_evaluated",
    "failed",
    "needs_review",
}
EVALUATION_STALE_AFTER = timedelta(minutes=15)


@dataclass(frozen=True)
class Assessment:
    status: str
    score: int | None
    level: str | None
    not_evaluated: list[str]
    dimensions: dict[str, Any]


def level_for_score(score: int) -> str:
    if score >= 95:
        return "A+"
    if score >= 85:
        return "A"
    if score >= 75:
        return "B+"
    if score >= 65:
        return "B"
    if score >= 55:
        return "C+"
    if score >= 45:
        return "C"
    return "D"


def compute_assessment(
    output: CodeReviewOutput,
    self_test: dict | None,
) -> Assessment:
    dimensions = output.dimensions.model_dump(mode="json")
    scores = {
        "correctness_risk": dimensions["correctness_risk"]["score"],
        "complexity": dimensions["complexity"]["score"],
        "quality": dimensions["quality"]["score"],
        "testing": dimensions["testing"]["score"],
        "communication": dimensions["communication"]["score"],
    }
    not_evaluated = list(output.not_evaluated)
    provided = bool(self_test and self_test.get("provided"))

    if not provided:
        not_evaluated.extend(["correctness_risk", "testing"])
        score = None
    else:
        missing = [name for name, value in scores.items() if value is None]
        not_evaluated.extend(missing)
        if missing:
            score = None
        else:
            score = round(
                sum(
                    int(scores[name]) * weight
                    for name, weight in DIMENSION_WEIGHTS.items()
                )
            )

    deduped = list(dict.fromkeys(not_evaluated))
    if score is None:
        return Assessment(
            status="not_evaluated",
            score=None,
            level=None,
            not_evaluated=deduped,
            dimensions=dimensions,
        )
    return Assessment(
        status="succeeded",
        score=score,
        level=level_for_score(score),
        not_evaluated=deduped,
        dimensions=dimensions,
    )


def _naive_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _step(
    order: int,
    name: str,
    *,
    status: str = "pending",
    detail: str | None = None,
) -> dict[str, Any]:
    return {
        "order": order,
        "name": name,
        "status": status,
        "detail": detail,
    }


def _initial_steps() -> list[dict[str, Any]]:
    return [
        _step(1, "准备提交快照"),
        _step(2, "AI 静态评审"),
        _step(3, "校验证据与评分"),
        _step(4, "保存评审结果"),
    ]


def _set_step(
    job: Job,
    order: int,
    status: str,
    *,
    stage: str,
    progress: str,
    detail: str | None = None,
) -> None:
    steps = copy.deepcopy(list(job.steps_json or _initial_steps()))
    for item in steps:
        if item.get("order") == order:
            item["status"] = status
            if detail is not None:
                item["detail"] = detail
            break
    job.steps_json = steps
    flag_modified(job, "steps_json")
    job.stage = stage
    job.progress = Decimal(progress)


def _sync_steps(job: Job, evaluation: CodeEvaluation) -> None:
    evaluation.process_steps_json = copy.deepcopy(job.steps_json or [])
    flag_modified(evaluation, "process_steps_json")


def _submission_payload(submission: CodeSubmission) -> dict[str, Any]:
    return {
        "submission_id": submission.id,
        "problem_title": submission.problem_title,
        "problem_source": submission.problem_source,
        "difficulty": submission.difficulty,
        "tags": list(submission.tags_json or []),
        "language": submission.language,
        "file_name": submission.file_name,
        "code_text": submission.code_text,
        "line_count": submission.line_count,
        "self_test": submission.self_test_json,
        "time_complexity": submission.time_complexity,
        "space_complexity": submission.space_complexity,
        "approach": submission.approach,
        "is_independent": submission.is_independent,
    }


def evaluation_summary(evaluation: CodeEvaluation) -> CodeEvaluationSummary:
    return CodeEvaluationSummary(
        id=evaluation.id,
        submission_id=evaluation.submission_id,
        sequence_no=evaluation.sequence_no,
        status=evaluation.status,
        is_current=evaluation.is_current,
        score=evaluation.score,
        level=evaluation.level,
        confidence=(
            float(evaluation.confidence)
            if evaluation.confidence is not None
            else None
        ),
        static_risk=evaluation.static_risk,
        error_code=evaluation.error_code,
        created_at=evaluation.created_at,
        finished_at=evaluation.finished_at,
    )


def evaluation_out(evaluation: CodeEvaluation) -> CodeEvaluationOut:
    return CodeEvaluationOut(
        **evaluation_summary(evaluation).model_dump(),
        job_id=evaluation.job_id,
        summary=evaluation.summary,
        dimensions=dict(evaluation.dimensions_json or {}),
        evidence=list(evaluation.evidence_json or []),
        strengths=list(evaluation.strengths_json or []),
        improvements=list(evaluation.improvements_json or []),
        followups=list(evaluation.followups_json or []),
        not_evaluated=list(evaluation.not_evaluated_json or []),
        process_steps=list(evaluation.process_steps_json or []),
        rubric_version=evaluation.rubric_version,
        prompt_version=evaluation.prompt_version,
        model=evaluation.model,
        error_detail=evaluation.error_detail,
        started_at=evaluation.started_at,
    )


def _get_submission(
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


def _lock_submission(
    db: Session, user: User, submission_id: str
) -> CodeSubmission:
    submission = db.scalar(
        select(CodeSubmission)
        .where(
            CodeSubmission.id == submission_id,
            CodeSubmission.user_id == user.id,
        )
        .with_for_update()
    )
    if submission is None:
        raise AppError("SUBMISSION_NOT_FOUND", "代码提交不存在", status_code=404)
    return submission


def _get_evaluation(
    db: Session, user: User, evaluation_id: str
) -> CodeEvaluation:
    evaluation = db.scalar(
        select(CodeEvaluation).where(
            CodeEvaluation.id == evaluation_id,
            CodeEvaluation.user_id == user.id,
        )
    )
    if evaluation is None:
        raise AppError("EVALUATION_NOT_FOUND", "评审不存在", status_code=404)
    return evaluation


def _mark_stale(
    db: Session,
    evaluation: CodeEvaluation,
    submission: CodeSubmission,
) -> None:
    now = _naive_utcnow()
    evaluation.status = "failed"
    evaluation.error_code = "EVALUATION_TIMEOUT"
    evaluation.error_detail = "评审超过 15 分钟未完成，已标记失败"
    evaluation.finished_at = now
    evaluation.is_current = False
    job = db.get(Job, evaluation.job_id) if evaluation.job_id else None
    if job is not None:
        steps = copy.deepcopy(list(job.steps_json or _initial_steps()))
        for item in steps:
            if item.get("status") in {"pending", "running"}:
                item["status"] = "failed"
                item["detail"] = item.get("detail") or evaluation.error_detail
                break
        job.steps_json = steps
        flag_modified(job, "steps_json")
        job.status = "failed"
        job.stage = "failed"
        job.retryable = True
        job.finished_at = now
        job.error_json = {
            "code": "EVALUATION_TIMEOUT",
            "message": evaluation.error_detail,
        }
        _sync_steps(job, evaluation)
    submission.latest_evaluation_id = evaluation.id
    submission.latest_job_id = evaluation.job_id
    submission.review_status = "failed"
    submission.latest_score = None


def start_evaluation(
    db: Session,
    user: User,
    submission_id: str,
) -> EvaluationStart:
    submission = _lock_submission(db, user, submission_id)
    consent_service.require_consent(db, user, "ai_code_review")

    running = db.scalar(
        select(CodeEvaluation)
        .where(
            CodeEvaluation.submission_id == submission.id,
            CodeEvaluation.user_id == user.id,
            CodeEvaluation.status.in_(("queued", "running")),
        )
        .with_for_update()
    )
    if running is not None:
        if running.created_at > _naive_utcnow() - EVALUATION_STALE_AFTER:
            raise AppError(
                "EVALUATION_IN_PROGRESS",
                "该提交已有评审在处理中",
                status_code=409,
                details={
                    "evaluation_id": running.id,
                    "job_id": running.job_id,
                },
                retryable=True,
            )
        _mark_stale(db, running, submission)

    sequence_no = int(
        db.scalar(
            select(func.max(CodeEvaluation.sequence_no)).where(
                CodeEvaluation.submission_id == submission.id
            )
        )
        or 0
    ) + 1
    provider = get_code_review_provider()
    evaluation = CodeEvaluation(
        user_id=user.id,
        submission_id=submission.id,
        sequence_no=sequence_no,
        status="queued",
        is_current=False,
        rubric_version=CODE_REVIEW_RUBRIC_VERSION,
        prompt_version=CODE_REVIEW_PROMPT_VERSION,
        model=provider.model or None,
        process_steps_json=_initial_steps(),
    )
    db.add(evaluation)
    db.flush()

    job = Job(
        user_id=user.id,
        job_type="code_review",
        status="queued",
        stage="queued",
        steps_json=_initial_steps(),
        progress=Decimal("0.05"),
        attempt=1,
        max_attempts=2,
        retryable=True,
        result_ref=f"evaluation:{evaluation.id}",
        result_version=str(sequence_no),
    )
    db.add(job)
    db.flush()
    evaluation.job_id = job.id
    submission.latest_evaluation_id = evaluation.id
    submission.latest_job_id = job.id
    submission.evaluation_count += 1
    submission.review_status = "queued"
    submission.latest_score = None
    db.commit()
    db.refresh(evaluation)
    db.refresh(job)

    from app.worker.celery_app import celery_app

    if celery_app.conf.task_always_eager:
        process_evaluation(db, evaluation.id, job.id)
    else:
        from app.worker.tasks import code_review_tasks

        try:
            code_review_tasks.process_code_review_task.delay(job.id, evaluation.id)
        except Exception:  # noqa: BLE001
            logger.warning(
                "code review broker unavailable, processing inline",
                exc_info=True,
            )
            process_evaluation(db, evaluation.id, job.id)

    db.refresh(evaluation)
    db.refresh(submission)
    return EvaluationStart(
        evaluation_id=evaluation.id,
        job_id=job.id,
        submission_id=submission.id,
        sequence_no=evaluation.sequence_no,
        status=evaluation.status,
    )


def process_evaluation(
    db: Session,
    evaluation_id: str,
    job_id: str,
) -> None:
    evaluation = db.scalar(
        select(CodeEvaluation)
        .where(CodeEvaluation.id == evaluation_id)
        .with_for_update()
    )
    if evaluation is None:
        db.rollback()
        return
    job = db.get(Job, job_id)
    if job is None or evaluation.status != "queued":
        db.rollback()
        return

    submission = db.get(CodeSubmission, evaluation.submission_id)
    user = db.get(User, evaluation.user_id)
    if submission is None or user is None:
        _fail(db, evaluation, job, "SUBMISSION_NOT_FOUND", "提交或用户不存在", False)
        return

    evaluation.status = "running"
    evaluation.started_at = _naive_utcnow()
    job.status = "running"
    job.started_at = job.started_at or evaluation.started_at
    _set_step(
        job,
        1,
        "succeeded",
        stage="preparing",
        progress="0.15",
        detail="已读取代码快照",
    )
    _set_step(
        job,
        2,
        "running",
        stage="reviewing",
        progress="0.35",
        detail="正在调用静态评审",
    )
    _sync_steps(job, evaluation)
    db.commit()

    payload = _submission_payload(submission)
    try:
        result = AIGateway(get_code_review_provider(), db).run(
            build_code_review_spec(),
            payload,
            user=user,
        )
    except AppError as exc:
        _fail(db, evaluation, job, exc.code, exc.message, exc.retryable)
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("unexpected code review failure")
        _fail(
            db,
            evaluation,
            job,
            "CODE_REVIEW_FAILED",
            f"评审内部错误: {type(exc).__name__}",
            True,
        )
        return

    # A stale job may have been marked failed by a newer retry while this
    # worker was waiting on the provider. Never write a formal result then.
    db.refresh(evaluation)
    if evaluation.status != "running":
        db.rollback()
        return

    _set_step(
        job,
        2,
        "succeeded",
        stage="validating",
        progress="0.70",
        detail="AI 输出已通过 Schema/质量校验",
    )
    _set_step(
        job,
        3,
        "running",
        stage="validating",
        progress="0.80",
        detail="正在计算评分与证据",
    )

    if result.needs_review:
        evaluation.status = "needs_review"
        evaluation.error_code = "AI_OUTPUT_NEEDS_REVIEW"
        evaluation.error_detail = "AI 输出需要人工复核，未写入正式评分"
        evaluation.finished_at = _naive_utcnow()
        _set_step(
            job,
            3,
            "succeeded",
            stage="completed",
            progress="1.00",
            detail="输出需人工复核，未写正式结果",
        )
        _set_step(job, 4, "succeeded", stage="completed", progress="1.00")
        _sync_steps(job, evaluation)
        job.status = "succeeded"
        job.finished_at = _naive_utcnow()
        job.retryable = True
        submission.latest_evaluation_id = evaluation.id
        submission.latest_job_id = job.id
        submission.review_status = "needs_review"
        submission.latest_score = None
        db.commit()
        return

    assessment = compute_assessment(result.data, submission.self_test_json)  # type: ignore[arg-type]
    old_current = db.scalars(
        select(CodeEvaluation).where(
            CodeEvaluation.submission_id == submission.id,
            CodeEvaluation.is_current.is_(True),
        )
    ).all()
    for item in old_current:
        item.is_current = False

    evaluation.is_current = True
    evaluation.status = assessment.status
    evaluation.score = assessment.score
    evaluation.level = assessment.level
    evaluation.confidence = Decimal(str(result.data.confidence))
    evaluation.static_risk = result.data.static_risk
    evaluation.summary = result.data.summary
    evaluation.dimensions_json = assessment.dimensions
    evaluation.evidence_json = [
        item.model_dump(mode="json") for item in result.data.evidence
    ]
    evaluation.strengths_json = list(result.data.strengths)
    evaluation.improvements_json = [
        item.model_dump(mode="json") for item in result.data.improvements
    ]
    evaluation.followups_json = [
        item.model_dump(mode="json") for item in result.data.followups
    ]
    evaluation.not_evaluated_json = assessment.not_evaluated
    evaluation.ai_run_id = result.ai_run_id
    evaluation.finished_at = _naive_utcnow()

    _set_step(
        job,
        3,
        "succeeded",
        stage="saving",
        progress="0.90",
        detail="评分与证据已生成",
    )
    _set_step(
        job,
        4,
        "succeeded",
        stage="completed",
        progress="1.00",
        detail="评审结果已保存",
    )
    _sync_steps(job, evaluation)
    job.status = "succeeded"
    job.finished_at = _naive_utcnow()
    job.retryable = False
    submission.latest_evaluation_id = evaluation.id
    submission.latest_job_id = job.id
    submission.current_evaluation_id = evaluation.id
    submission.review_status = evaluation.status
    submission.latest_score = evaluation.score
    db.commit()


def _fail(
    db: Session,
    evaluation: CodeEvaluation,
    job: Job,
    code: str,
    message: str,
    retryable: bool,
) -> None:
    evaluation.status = "failed"
    evaluation.error_code = code
    evaluation.error_detail = message[:2000]
    evaluation.finished_at = _naive_utcnow()
    evaluation.is_current = False
    job.status = "failed"
    job.finished_at = _naive_utcnow()
    job.retryable = retryable
    job.error_json = {"code": code, "message": message}
    steps = copy.deepcopy(list(job.steps_json or _initial_steps()))
    for item in steps:
        if item.get("status") in {"pending", "running"}:
            item["status"] = "failed"
            if item.get("detail") is None:
                item["detail"] = message[:300]
            break
    job.steps_json = steps
    flag_modified(job, "steps_json")
    _sync_steps(job, evaluation)
    submission = db.get(CodeSubmission, evaluation.submission_id)
    if submission is not None:
        submission.latest_evaluation_id = evaluation.id
        submission.latest_job_id = job.id
        submission.review_status = "failed"
        submission.latest_score = None
    db.commit()


def list_evaluations(
    db: Session,
    user: User,
    submission_id: str,
    *,
    limit: int,
    offset: int,
) -> tuple[list[CodeEvaluation], int]:
    submission = _get_submission(db, user, submission_id)
    total = int(
        db.scalar(
            select(func.count())
            .select_from(CodeEvaluation)
            .where(CodeEvaluation.submission_id == submission.id)
        )
        or 0
    )
    items = list(
        db.scalars(
            select(CodeEvaluation)
            .where(CodeEvaluation.submission_id == submission.id)
            .order_by(CodeEvaluation.sequence_no.desc())
            .offset(offset)
            .limit(limit)
        )
    )
    return items, total


def get_evaluation(
    db: Session,
    user: User,
    evaluation_id: str,
) -> CodeEvaluationOut:
    return evaluation_out(_get_evaluation(db, user, evaluation_id))

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.ai.client import JSONProvider
from app.core.errors import AppError
from app.models.system import AiRun
from app.models.user import User
from app.services import consent_service

QualityDimension = Literal["grounding", "completeness", "consistency", "safety"]
Decision = Literal["accepted", "needs_review", "rejected"]


class ValidationIssue(BaseModel):
    code: str
    message: str
    dimension: QualityDimension
    severity: Literal["error", "warning"] = "error"
    path: str | None = None


@dataclass(frozen=True)
class QualityPolicy:
    accept_threshold: float = 0.85
    review_threshold: float = 0.70
    error_penalty: float = 0.25
    warning_penalty: float = 0.10
    weights: tuple[tuple[str, float], ...] = (
        ("grounding", 0.35),
        ("completeness", 0.20),
        ("consistency", 0.25),
        ("safety", 0.20),
    )

    def __post_init__(self) -> None:
        if not 0 <= self.review_threshold <= self.accept_threshold <= 1:
            raise ValueError("quality thresholds must satisfy 0 <= review <= accept <= 1")
        if sum(weight for _, weight in self.weights) <= 0:
            raise ValueError("quality weights must sum to a positive value")


class QualityReport(BaseModel):
    schema_valid: bool
    grounding: float
    completeness: float
    consistency: float
    safety: float
    overall: float
    decision: Decision
    issues: list[ValidationIssue] = Field(default_factory=list)


def evaluate_quality(
    issues: list[ValidationIssue],
    policy: QualityPolicy | None = None,
    *,
    schema_valid: bool = True,
) -> QualityReport:
    policy = policy or QualityPolicy()
    if not schema_valid:
        return QualityReport(
            schema_valid=False,
            grounding=0.0,
            completeness=0.0,
            consistency=0.0,
            safety=0.0,
            overall=0.0,
            decision="rejected",
            issues=issues,
        )

    scores = {
        "grounding": 1.0,
        "completeness": 1.0,
        "consistency": 1.0,
        "safety": 1.0,
    }
    for issue in issues:
        penalty = (
            policy.error_penalty if issue.severity == "error" else policy.warning_penalty
        )
        scores[issue.dimension] = max(0.0, scores[issue.dimension] - penalty)

    weight_sum = sum(weight for _, weight in policy.weights)
    overall = sum(
        scores[dimension] * weight
        for dimension, weight in policy.weights
        if dimension in scores
    ) / weight_sum
    has_error = any(issue.severity == "error" for issue in issues)
    safety_failed = any(
        issue.dimension == "safety" and issue.severity == "error" for issue in issues
    )

    if safety_failed:
        decision: Decision = "rejected"
    elif has_error:
        decision = "needs_review" if overall >= policy.review_threshold else "rejected"
    elif overall >= policy.accept_threshold:
        decision = "accepted"
    elif overall >= policy.review_threshold:
        decision = "needs_review"
    else:
        decision = "rejected"

    return QualityReport(
        schema_valid=True,
        grounding=scores["grounding"],
        completeness=scores["completeness"],
        consistency=scores["consistency"],
        safety=scores["safety"],
        overall=round(overall, 4),
        decision=decision,
        issues=issues,
    )


@dataclass(frozen=True)
class AITaskSpec:
    task_type: str
    prompt_version: str
    schema_version: str
    response_model: type[BaseModel]
    system_prompt: str
    build_user_prompt: Callable[[Any], str]
    consent_scope: str
    validators: tuple[Callable[[BaseModel, Any], list[ValidationIssue]], ...] = ()
    quality_policy: QualityPolicy = QualityPolicy()
    max_retries: int = 1
    timeout_seconds: float = 90.0


@dataclass(frozen=True)
class HarnessResult:
    data: BaseModel
    quality: QualityReport
    ai_run_id: str
    needs_review: bool

    @property
    def formal_data(self) -> BaseModel:
        """Data safe to persist as a formal score/evidence/result.

        Callers may use ``data`` for a review UI, but must use this property
        before writing an official score, route or evidence row.
        """
        if self.needs_review:
            raise AppError(
                "AI_OUTPUT_NEEDS_REVIEW",
                "AI 输出需要人工复核，不能作为正式结果",
                status_code=409,
                details={"quality": self.quality.model_dump(mode="json")},
                retryable=True,
            )
        return self.data


class AIGateway:
    """Run a task through consent, provider, validation and quality gates."""

    def __init__(self, provider: JSONProvider, db: Session) -> None:
        self.provider = provider
        self.db = db

    def run(
        self,
        spec: AITaskSpec,
        payload: Any,
        *,
        user: User,
    ) -> HarnessResult:
        consent_service.require_consent(self.db, user, spec.consent_scope)
        input_json = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        input_hash = hashlib.sha256(
            f"{spec.task_type}:{spec.prompt_version}:{input_json}".encode()
        ).hexdigest()
        run = AiRun(
            user_id=user.id,
            run_type=spec.task_type,
            provider=self.provider.name,
            model=self.provider.model,
            prompt_version=spec.prompt_version,
            schema_version=spec.schema_version,
            consent_scope=spec.consent_scope,
            input_hash=input_hash,
            input_snapshot_json={
                "payload_type": type(payload).__name__,
                "payload_bytes": len(input_json.encode("utf-8")),
                "payload_keys": (
                    sorted(str(key) for key in payload)
                    if isinstance(payload, dict)
                    else None
                ),
            },
            status="running",
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)

        started = time.monotonic()
        attempts: list[dict[str, Any]] = []
        last_error: AppError | None = None
        last_quality: QualityReport | None = None
        system_prompt = _system_prompt(spec)

        for attempt in range(spec.max_retries + 1):
            try:
                raw = self.provider.complete_json(
                    system_prompt=system_prompt,
                    user_prompt=spec.build_user_prompt(payload),
                    timeout_seconds=spec.timeout_seconds,
                )
                data = spec.response_model.model_validate(raw)
                issues: list[ValidationIssue] = []
                for validator in spec.validators:
                    issues.extend(validator(data, payload))
                quality = evaluate_quality(issues, spec.quality_policy)
                attempts.append(
                    {
                        "attempt": attempt + 1,
                        "outcome": quality.decision,
                        "issues": [issue.model_dump(mode="json") for issue in issues],
                    }
                )
                last_quality = quality
                last_error = None
            except ValidationError as exc:
                quality = evaluate_quality(
                    [
                        ValidationIssue(
                            code="SCHEMA_INVALID",
                            message="AI 输出不符合任务 Schema",
                            dimension="completeness",
                            severity="error",
                        )
                    ],
                    spec.quality_policy,
                    schema_valid=False,
                )
                attempts.append(
                    {
                        "attempt": attempt + 1,
                        "outcome": "schema_invalid",
                        "errors": [
                            {
                                "loc": list(error.get("loc", [])),
                                "msg": error.get("msg"),
                                "type": error.get("type"),
                            }
                            for error in exc.errors(include_url=False)[:5]
                        ],
                    }
                )
                last_quality = quality
                last_error = AppError(
                    "AI_OUTPUT_REJECTED",
                    "AI 输出结构不合法",
                    status_code=502,
                    details={"reason": "schema_invalid"},
                    retryable=True,
                )
                if attempt < spec.max_retries:
                    continue
                break
            except AppError as exc:
                attempts.append(
                    {
                        "attempt": attempt + 1,
                        "outcome": "provider_error",
                        "code": exc.code,
                    }
                )
                last_error = exc
                last_quality = None
                if not exc.retryable:
                    break
                if attempt < spec.max_retries:
                    continue
                break

            if quality.decision == "rejected" and attempt < spec.max_retries:
                last_error = AppError(
                    "AI_OUTPUT_REJECTED",
                    "AI 输出质量未达到阈值",
                    status_code=502,
                    details={"quality": quality.model_dump(mode="json")},
                    retryable=True,
                )
                continue

            run.latency_ms = int((time.monotonic() - started) * 1000)
            run.validation_json = {
                "schema_valid": quality.schema_valid,
                "attempts": attempts,
                "issues": [issue.model_dump(mode="json") for issue in quality.issues],
            }
            run.quality_score = quality.overall
            run.quality_json = quality.model_dump(mode="json")

            if quality.decision == "rejected":
                run.status = "failed"
                run.error_code = "AI_OUTPUT_REJECTED"
                run.error_detail = "AI 输出质量未达到阈值"
                run.output_json = None
                self.db.commit()
                raise AppError(
                    "AI_OUTPUT_REJECTED",
                    "AI 输出质量未达到阈值",
                    status_code=502,
                    details={"quality": quality.model_dump(mode="json")},
                    retryable=True,
                )

            run.status = "succeeded"
            run.output_json = data.model_dump(mode="json")
            run.error_code = None
            run.error_detail = None
            self.db.commit()
            return HarnessResult(
                data=data,
                quality=quality,
                ai_run_id=run.id,
                needs_review=quality.decision == "needs_review",
            )

        run.latency_ms = int((time.monotonic() - started) * 1000)
        run.status = "failed"
        run.validation_json = {"attempts": attempts}
        if last_quality is not None:
            run.quality_score = last_quality.overall
            run.quality_json = last_quality.model_dump(mode="json")
        if last_error is not None:
            run.error_code = last_error.code
            run.error_detail = last_error.message
            self.db.commit()
            raise last_error
        run.error_code = "AI_OUTPUT_REJECTED"
        run.error_detail = "AI 输出在重试后仍未通过校验"
        self.db.commit()
        raise AppError(
            "AI_OUTPUT_REJECTED",
            "AI 输出在重试后仍未通过校验",
            status_code=502,
            details={
                "quality": last_quality.model_dump(mode="json")
                if last_quality is not None
                else None
            },
            retryable=True,
        )


def _system_prompt(spec: AITaskSpec) -> str:
    schema = json.dumps(
        spec.response_model.model_json_schema(),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return (
        f"{spec.system_prompt}\n\n"
        "输出必须是单个 JSON 对象，且严格符合以下 JSON Schema；"
        "不得输出 Markdown、解释、代码块或 Schema 之外的字段。\n"
        f"<JSON_SCHEMA>\n{schema}\n</JSON_SCHEMA>"
    )




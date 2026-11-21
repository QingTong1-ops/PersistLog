from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import UTCDateTime

Language = Literal["python", "java", "javascript", "typescript"]
Difficulty = Literal["easy", "medium", "hard", "unrated"]

ALLOWED_LANGUAGES: tuple[Language, ...] = (
    "python",
    "java",
    "javascript",
    "typescript",
)


class SelfTest(BaseModel):
    provided: bool = False
    passed: int | None = Field(default=None, ge=0)
    total: int | None = Field(default=None, ge=1)
    failures: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("failures")
    @classmethod
    def _validate_failures(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value or len(value) > 500 for value in cleaned):
            raise ValueError("失败用例描述必须为 1–500 个字符")
        return cleaned

    @model_validator(mode="after")
    def _validate_consistency(self) -> SelfTest:
        if self.provided:
            if self.passed is None or self.total is None:
                raise ValueError("已自测时必须提供 passed 和 total")
            if self.passed > self.total:
                raise ValueError("passed 不能大于 total")
        else:
            if self.passed is not None or self.total is not None:
                raise ValueError("未自测时不要填写 passed/total")
            if self.failures:
                raise ValueError("未自测时不要填写失败用例")
        return self


def _normalize_tags(values: list[str], *, limit: int, max_length: int) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        tag = value.strip()
        if not tag:
            continue
        if len(tag) > max_length:
            raise ValueError(f"标签长度不能超过 {max_length}")
        if tag not in cleaned:
            cleaned.append(tag)
    if len(cleaned) > limit:
        raise ValueError(f"标签最多 {limit} 个")
    return cleaned


class CodeInput(BaseModel):
    problem_title: str = Field(min_length=1, max_length=300)
    problem_source: str | None = Field(default=None, max_length=300)
    difficulty: Difficulty = "unrated"
    tags: list[str] = Field(default_factory=list, max_length=10)
    language: Language
    file_name: str | None = Field(default=None, max_length=255)
    code_text: str = Field(min_length=1, max_length=204800)
    self_test: SelfTest | None = None
    time_complexity: str = Field(min_length=1, max_length=64)
    space_complexity: str = Field(min_length=1, max_length=64)
    approach: str | None = Field(default=None, max_length=5000)
    is_independent: bool = False
    capability_codes: list[str] = Field(default_factory=list, max_length=11)
    task_id: str | None = None
    task_occurrence_id: str | None = None

    @field_validator("tags")
    @classmethod
    def _tags(cls, values: list[str]) -> list[str]:
        return _normalize_tags(values, limit=10, max_length=32)

    @field_validator("capability_codes")
    @classmethod
    def _capability_codes(cls, values: list[str]) -> list[str]:
        return _normalize_tags(values, limit=11, max_length=64)


class PracticeDraftCreate(CodeInput):
    pass


class PracticeDraftUpdate(BaseModel):
    version: int = Field(ge=1)
    problem_title: str | None = Field(default=None, min_length=1, max_length=300)
    problem_source: str | None = Field(default=None, max_length=300)
    difficulty: Difficulty | None = None
    tags: list[str] | None = Field(default=None, max_length=10)
    language: Language | None = None
    file_name: str | None = Field(default=None, max_length=255)
    code_text: str | None = Field(default=None, min_length=1, max_length=204800)
    self_test: SelfTest | None = None
    time_complexity: str | None = Field(default=None, min_length=1, max_length=64)
    space_complexity: str | None = Field(default=None, min_length=1, max_length=64)
    approach: str | None = Field(default=None, max_length=5000)
    is_independent: bool | None = None
    capability_codes: list[str] | None = Field(default=None, max_length=11)
    task_id: str | None = None
    task_occurrence_id: str | None = None

    @field_validator("tags")
    @classmethod
    def _tags(cls, values: list[str] | None) -> list[str] | None:
        return (
            _normalize_tags(values, limit=10, max_length=32)
            if values is not None
            else None
        )

    @field_validator("capability_codes")
    @classmethod
    def _capability_codes(cls, values: list[str] | None) -> list[str] | None:
        return (
            _normalize_tags(values, limit=11, max_length=64)
            if values is not None
            else None
        )


class PracticeDraftSubmit(BaseModel):
    version: int = Field(ge=1)


class PracticeTaskContext(BaseModel):
    task_id: str
    occurrence_id: str | None = None
    title: str
    task_type: str
    route_id: str | None = None
    route_title: str | None = None
    stage_id: str | None = None
    stage_name: str | None = None
    week_id: str | None = None
    week_focus: str | None = None
    estimated_minutes: int
    deliverable: str
    acceptance_criteria: str
    capability_codes: list[str] = Field(default_factory=list)


class PracticeContextOut(BaseModel):
    task_context: PracticeTaskContext | None = None
    allowed_languages: list[Language] = Field(
        default_factory=lambda: list(ALLOWED_LANGUAGES)
    )
    default_language: Language = "python"


class PracticeDraftSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    problem_title: str
    language: str
    version: int
    status: str
    source_submission_id: str | None = None
    task_context: PracticeTaskContext | None = None
    updated_at: UTCDateTime


class PracticeDraftOut(PracticeDraftSummary):
    problem_source: str | None = None
    difficulty: str
    tags: list[str] = Field(default_factory=list)
    file_name: str
    code_text: str
    line_count: int
    code_hash: str
    self_test: SelfTest | None = None
    time_complexity: str
    space_complexity: str
    approach: str | None = None
    is_independent: bool
    capability_codes: list[str] = Field(default_factory=list)
    task_id: str | None = None
    task_occurrence_id: str | None = None
    last_submission_id: str | None = None
    created_at: UTCDateTime


class PracticeSubmissionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    problem_title: str
    language: str
    difficulty: str
    task_id: str | None = None
    code_hash: str
    line_count: int
    review_status: str = "not_started"
    evaluation_count: int = 0
    latest_evaluation_id: str | None = None
    latest_job_id: str | None = None
    current_evaluation_id: str | None = None
    latest_score: int | None = None
    created_at: UTCDateTime


class PracticeSubmissionOut(PracticeSubmissionSummary):
    draft_id: str | None = None
    source_submission_id: str | None = None
    task_occurrence_id: str | None = None
    problem_source: str | None = None
    tags: list[str] = Field(default_factory=list)
    file_name: str
    code_text: str
    self_test: SelfTest | None = None
    time_complexity: str
    space_complexity: str
    approach: str | None = None
    is_independent: bool
    capability_codes: list[str] = Field(default_factory=list)
    consent_version: str
    consent_scope: str
    task_context: PracticeTaskContext | None = None


class PracticeSubmissionCreate(CodeInput):
    pass


class CodeEvaluationSummary(BaseModel):
    id: str
    submission_id: str
    sequence_no: int
    status: str
    is_current: bool
    score: int | None = None
    level: str | None = None
    confidence: float | None = None
    static_risk: str | None = None
    error_code: str | None = None
    created_at: UTCDateTime
    finished_at: UTCDateTime | None = None


class CodeEvaluationOut(CodeEvaluationSummary):
    job_id: str | None = None
    summary: str | None = None
    dimensions: dict[str, Any] = Field(default_factory=dict)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[dict[str, Any]] = Field(default_factory=list)
    followups: list[dict[str, Any]] = Field(default_factory=list)
    not_evaluated: list[str] = Field(default_factory=list)
    process_steps: list[dict[str, Any]] = Field(default_factory=list)
    rubric_version: str
    prompt_version: str
    model: str | None = None
    error_detail: str | None = None
    started_at: UTCDateTime | None = None


class EvaluationStart(BaseModel):
    evaluation_id: str
    job_id: str
    submission_id: str
    sequence_no: int
    status: str

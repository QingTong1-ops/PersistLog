from __future__ import annotations

import json
from typing import Any

import pytest
from app.ai.harness import (
    AIGateway,
    AITaskSpec,
    QualityPolicy,
    ValidationIssue,
)
from app.core.errors import AppError
from app.models.system import AiRun
from app.models.user import User
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.api.test_auth import auth_header, register


class SampleOutput(BaseModel):
    answer: str
    evidence: list[str] = Field(default_factory=list)
    score: int


class FakeProvider:
    name = "fake"
    model = "fake-model"

    def __init__(self, responses: list[dict[str, Any] | Exception]) -> None:
        self.responses = responses
        self.calls: list[dict[str, str]] = []

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        self.calls.append(
            {
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
            }
        )
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def _spec(
    *,
    max_retries: int = 0,
    validators: tuple[Any, ...] = (),
) -> AITaskSpec:
    return AITaskSpec(
        task_type="sample_review",
        prompt_version="sample-v1",
        schema_version="sample-schema-v1",
        response_model=SampleOutput,
        system_prompt="只根据输入回答，不得编造证据。",
        build_user_prompt=lambda payload: f"<INPUT>{payload['text']}</INPUT>",
        consent_scope="ai_code_review",
        validators=validators,
        quality_policy=QualityPolicy(),
        max_retries=max_retries,
    )


def _evidence_validator(data: SampleOutput, payload: Any) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if not data.evidence:
        issues.append(
            ValidationIssue(
                code="MISSING_EVIDENCE",
                message="没有提供证据",
                dimension="grounding",
                severity="error",
            )
        )
    if "AC" in data.answer:
        issues.append(
            ValidationIssue(
                code="FORBIDDEN_AC_CLAIM",
                message="不得声称 AC",
                dimension="safety",
                severity="error",
            )
        )
    return issues


def _grant(client: TestClient, token: str, scope: str = "ai_code_review") -> None:
    response = client.put(
        "/api/v1/consents",
        headers=auth_header(token),
        json={"scope": scope, "version": "v1", "granted": True},
    )
    assert response.status_code == 200, response.text


def _user(client: TestClient, db: Session) -> tuple[dict, User]:
    body = register(client, email="harness@example.com")
    _grant(client, body["access_token"])
    user = db.get(User, body["user"]["id"])
    assert user is not None
    return body, user


def test_harness_accepts_grounded_output(
    client: TestClient, db: Session
) -> None:
    body, user = _user(client, db)
    provider = FakeProvider(
        [{"answer": "已提供证据", "evidence": ["line 1"], "score": 80}]
    )
    result = AIGateway(provider, db).run(
        _spec(validators=(_evidence_validator,)),
        {"text": "SECRET_INPUT"},
        user=user,
    )

    assert result.quality.decision == "accepted"
    assert result.needs_review is False
    assert result.data.score == 80
    assert "<JSON_SCHEMA>" in provider.calls[0]["system_prompt"]
    assert "SECRET_INPUT" in provider.calls[0]["user_prompt"]

    run = db.scalar(select(AiRun).where(AiRun.id == result.ai_run_id))
    assert run is not None
    assert run.status == "succeeded"
    assert float(run.quality_score or 0) == 1.0
    assert "SECRET_INPUT" not in json.dumps(run.input_snapshot_json)


def test_harness_rejects_invalid_schema_without_writing_output(
    client: TestClient, db: Session
) -> None:
    _, user = _user(client, db)
    provider = FakeProvider([{"answer": "缺少 evidence 和 score"}])
    with pytest.raises(AppError) as exc:
        AIGateway(provider, db).run(_spec(), {"text": "x"}, user=user)
    assert exc.value.code == "AI_OUTPUT_REJECTED"

    run = db.scalar(select(AiRun).where(AiRun.user_id == user.id))
    assert run is not None
    assert run.status == "failed"
    assert run.output_json is None
    assert run.validation_json["attempts"][0]["outcome"] == "schema_invalid"


def test_harness_marks_grounding_error_as_needs_review(
    client: TestClient, db: Session
) -> None:
    _, user = _user(client, db)
    provider = FakeProvider([{"answer": "没有证据", "evidence": [], "score": 60}])
    result = AIGateway(provider, db).run(
        _spec(validators=(_evidence_validator,)),
        {"text": "x"},
        user=user,
    )
    assert result.quality.decision == "needs_review"
    assert result.needs_review is True
    assert result.quality.grounding < 1.0
    with pytest.raises(AppError) as exc:
        _ = result.formal_data
    assert exc.value.code == "AI_OUTPUT_NEEDS_REVIEW"


def test_harness_rejects_safety_violation(
    client: TestClient, db: Session
) -> None:
    _, user = _user(client, db)
    provider = FakeProvider(
        [{"answer": "AC 通过，隐藏测试全过", "evidence": ["line 1"], "score": 99}]
    )
    with pytest.raises(AppError) as exc:
        AIGateway(provider, db).run(
            _spec(validators=(_evidence_validator,)),
            {"text": "x"},
            user=user,
        )
    assert exc.value.code == "AI_OUTPUT_REJECTED"
    run = db.scalar(select(AiRun).where(AiRun.user_id == user.id))
    assert run is not None
    assert run.output_json is None
    assert run.quality_json["safety"] < 1.0


def test_harness_requires_purpose_consent(
    client: TestClient, db: Session
) -> None:
    body = register(client, email="harness-no-consent@example.com")
    user = db.get(User, body["user"]["id"])
    assert user is not None
    provider = FakeProvider(
        [{"answer": "ok", "evidence": ["line 1"], "score": 80}]
    )
    with pytest.raises(AppError) as exc:
        AIGateway(provider, db).run(_spec(), {"text": "x"}, user=user)
    assert exc.value.code == "AI_CONSENT_REQUIRED"
    assert exc.value.details == {"scope": "ai_code_review"}


def test_harness_retries_schema_failure_then_accepts(
    client: TestClient, db: Session
) -> None:
    _, user = _user(client, db)
    provider = FakeProvider(
        [
            {"answer": "缺少字段"},
            {"answer": "补全", "evidence": ["line 1"], "score": 90},
        ]
    )
    result = AIGateway(provider, db).run(
        _spec(max_retries=1, validators=(_evidence_validator,)),
        {"text": "x"},
        user=user,
    )
    assert result.quality.decision == "accepted"
    run = db.scalar(select(AiRun).where(AiRun.id == result.ai_run_id))
    assert run is not None
    assert len(run.validation_json["attempts"]) == 2

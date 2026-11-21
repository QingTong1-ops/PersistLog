from __future__ import annotations

from typing import Any

from app.core.errors import AppError
from app.services import code_review_service
from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_practice import _grant_code_consent, _payload


def _review_payload(*, evidence: list[dict] | None = None) -> dict[str, Any]:
    return {
        "summary": "静态检查发现边界和命名可改进，未运行代码。",
        "static_risk": "medium",
        "confidence": 0.82,
        "dimensions": {
            "correctness_risk": {
                "level": "medium",
                "score": 63,
                "reason": "空输入和重复值分支未覆盖",
                "deductions": ["边界处理"],
            },
            "complexity": {
                "score": 80,
                "reason": "时间复杂度 O(n)",
                "deductions": [],
            },
            "quality": {
                "score": 74,
                "reason": "变量命名可更明确",
                "deductions": [],
            },
            "testing": {
                "score": 60,
                "reason": "自测覆盖不足",
                "deductions": ["缺少空数组"],
            },
            "communication": {
                "score": 70,
                "reason": "思路说明较完整",
                "deductions": [],
            },
        },
        "evidence": evidence
        if evidence is not None
        else [
            {
                "file": "solution.py",
                "start_line": 1,
                "end_line": 2,
                "quote": "def two_sum(nums, target):",
                "issue": "缺少空输入处理",
                "severity": "medium",
                "suggestion": "先处理空列表",
            }
        ],
        "strengths": ["哈希表思路正确"],
        "improvements": [
            {
                "title": "补齐边界",
                "action": "处理空数组",
                "how": "在函数入口判断",
                "verify": "补充空数组自测",
            }
        ],
        "followups": [
            {
                "question": "如果数组为空，应该返回什么？",
                "context": "边界条件",
            }
        ],
        "not_evaluated": [],
    }


class _FakeProvider:
    name = "fake"
    model = "fake-review-v1"

    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.calls = 0

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        self.calls += 1
        return self.payload


class _FailingProvider:
    name = "fake"
    model = "fake-review-v1"

    def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_seconds: float,
    ) -> dict[str, Any]:
        raise AppError(
            "AI_PROVIDER_ERROR",
            "模拟评审失败",
            status_code=502,
            retryable=True,
        )


def _fake_provider(monkeypatch, payload: dict[str, Any]) -> _FakeProvider:
    provider = _FakeProvider(payload)
    monkeypatch.setattr(
        code_review_service,
        "get_code_review_provider",
        lambda: provider,
    )
    return provider


def test_submission_auto_starts_stub_review(client: TestClient) -> None:
    body = register(client, email="review-stub@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    response = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["review_status"] == "not_evaluated"
    assert data["evaluation_count"] == 1
    assert data["latest_evaluation_id"]
    assert data["latest_job_id"]
    assert data["latest_score"] is None

    history = client.get(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["status"] == "not_evaluated"

    job = client.get(
        f"/api/v1/jobs/{data['latest_job_id']}",
        headers=auth_header(token),
    )
    assert job.status_code == 200, job.text
    job_data = job.json()
    assert job_data["status"] == "succeeded"
    assert job_data["stage"] == "completed"
    assert float(job_data["progress"]) == 1.0
    assert len(job_data["steps"]) == 4
    assert all(step["status"] == "succeeded" for step in job_data["steps"])


def test_accepted_review_computes_score_and_evidence(
    client: TestClient, monkeypatch
) -> None:
    _fake_provider(monkeypatch, _review_payload())
    body = register(client, email="review-score@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    response = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(file_name="solution.py"),
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["review_status"] == "succeeded"
    assert data["latest_score"] == 69
    assert data["evaluation_count"] == 1
    assert data["current_evaluation_id"] == data["latest_evaluation_id"]

    detail = client.get(
        f"/api/v1/practice/evaluations/{data['latest_evaluation_id']}",
        headers=auth_header(token),
    )
    assert detail.status_code == 200, detail.text
    review = detail.json()
    assert review["status"] == "succeeded"
    assert review["score"] == 69
    assert review["level"] == "B"
    assert review["is_current"] is True
    assert review["dimensions"]["correctness_risk"]["score"] == 63
    assert review["evidence"][0]["start_line"] == 1
    assert review["improvements"][0]["title"] == "补齐边界"
    assert review["followups"][0]["question"]
    assert review["job_id"] == data["latest_job_id"]
    assert review["rubric_version"] == "code-review-v1"


def test_invalid_evidence_is_not_written_as_formal_score(
    client: TestClient, monkeypatch
) -> None:
    _fake_provider(
        monkeypatch,
        _review_payload(
            evidence=[
                {
                    "file": "solution.py",
                    "start_line": 999,
                    "end_line": 1000,
                    "quote": "不存在",
                    "issue": "越界证据",
                    "severity": "high",
                    "suggestion": "修正",
                }
            ]
        ),
    )
    body = register(client, email="review-evidence@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    response = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["review_status"] == "needs_review"
    assert data["latest_score"] is None

    detail = client.get(
        f"/api/v1/practice/evaluations/{data['latest_evaluation_id']}",
        headers=auth_header(token),
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "needs_review"
    assert detail.json()["score"] is None
    assert detail.json()["error_code"] == "AI_OUTPUT_NEEDS_REVIEW"


def test_forbidden_runtime_claim_is_rejected(
    client: TestClient, monkeypatch
) -> None:
    payload = _review_payload()
    payload["summary"] = "已 AC，所有隐藏测试通过。"
    _fake_provider(monkeypatch, payload)
    body = register(client, email="review-claim@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    response = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["review_status"] == "failed"
    assert data["latest_score"] is None
    detail = client.get(
        f"/api/v1/practice/evaluations/{data['latest_evaluation_id']}",
        headers=auth_header(token),
    )
    assert detail.status_code == 200
    assert detail.json()["error_code"] == "AI_OUTPUT_REJECTED"


def test_retry_keeps_failed_attempt_and_current_success(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(
        code_review_service,
        "get_code_review_provider",
        lambda: _FailingProvider(),
    )
    body = register(client, email="review-retry@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    created = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert created.status_code == 201, created.text
    data = created.json()
    assert data["review_status"] == "failed"
    first_id = data["latest_evaluation_id"]

    _fake_provider(monkeypatch, _review_payload())
    retried = client.post(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    assert retried.status_code == 202, retried.text
    assert retried.json()["sequence_no"] == 2

    history = client.get(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    assert history.status_code == 200
    items = history.json()["items"]
    assert history.json()["total"] == 2
    assert [item["sequence_no"] for item in items] == [2, 1]
    assert items[0]["status"] == "succeeded"
    assert items[0]["is_current"] is True
    assert items[1]["id"] == first_id
    assert items[1]["status"] == "failed"
    assert items[1]["is_current"] is False

    submission = client.get(
        f"/api/v1/practice/submissions/{data['id']}",
        headers=auth_header(token),
    )
    assert submission.json()["review_status"] == "succeeded"
    assert submission.json()["latest_score"] == 69
    assert submission.json()["evaluation_count"] == 2
    assert submission.json()["current_evaluation_id"] == retried.json()["evaluation_id"]


def test_running_review_blocks_duplicate_start(
    client: TestClient, monkeypatch
) -> None:
    body = register(client, email="review-running@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    monkeypatch.setattr(
        code_review_service,
        "process_evaluation",
        lambda db, evaluation_id, job_id: None,
    )
    created = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert created.status_code == 201, created.text
    data = created.json()
    assert data["review_status"] == "queued"

    duplicate = client.post(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "EVALUATION_IN_PROGRESS"
    assert duplicate.json()["error"]["retryable"] is True


def test_stale_running_review_can_be_retried(
    client: TestClient, db, monkeypatch
) -> None:
    from datetime import UTC, datetime, timedelta

    from app.models.practice import CodeEvaluation

    body = register(client, email="review-stale@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    monkeypatch.setattr(
        code_review_service,
        "process_evaluation",
        lambda db, evaluation_id, job_id: None,
    )
    created = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert created.status_code == 201
    data = created.json()
    evaluation = db.get(CodeEvaluation, data["latest_evaluation_id"])
    assert evaluation is not None
    evaluation.created_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(
        minutes=16
    )
    db.commit()

    retried = client.post(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    assert retried.status_code == 202, retried.text
    assert retried.json()["sequence_no"] == 2

    history = client.get(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    items = history.json()["items"]
    assert [item["sequence_no"] for item in items] == [2, 1]
    assert items[1]["status"] == "failed"
    assert items[1]["error_code"] == "EVALUATION_TIMEOUT"
    assert items[0]["status"] == "queued"


def test_revoked_consent_blocks_review_and_user_isolation(
    client: TestClient,
) -> None:
    body = register(client, email="review-consent@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    created = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(),
    )
    assert created.status_code == 201
    data = created.json()

    revoked = client.put(
        "/api/v1/consents",
        headers=auth_header(token),
        json={"scope": "ai_code_review", "version": "v1", "granted": False},
    )
    assert revoked.status_code == 200
    blocked = client.post(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(token),
    )
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "AI_CONSENT_REQUIRED"

    bob = register(client, email="review-bob@example.com")
    other = client.get(
        f"/api/v1/practice/evaluations/{data['latest_evaluation_id']}",
        headers=auth_header(bob["access_token"]),
    )
    assert other.status_code == 404
    other_history = client.get(
        f"/api/v1/practice/submissions/{data['id']}/evaluations",
        headers=auth_header(bob["access_token"]),
    )
    assert other_history.status_code == 404

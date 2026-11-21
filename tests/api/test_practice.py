from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.test_auth import auth_header, register
from tests.api.test_planning import prepare_route


def _grant_code_consent(client: TestClient, token: str) -> None:
    response = client.put(
        "/api/v1/consents",
        headers=auth_header(token),
        json={"scope": "ai_code_review", "version": "v1", "granted": True},
    )
    assert response.status_code == 200, response.text


def _payload(**overrides: object) -> dict:
    data = {
        "problem_title": "两数之和",
        "problem_source": "LeetCode 1",
        "difficulty": "easy",
        "tags": ["array", "hash"],
        "language": "python",
        "code_text": "def two_sum(nums, target):\n    seen = {}\n    return []",
        "self_test": {"provided": True, "passed": 3, "total": 3, "failures": []},
        "time_complexity": "O(n)",
        "space_complexity": "O(n)",
        "approach": "哈希表",
        "is_independent": True,
        "capability_codes": ["algorithm"],
    }
    data.update(overrides)
    return data


def _create_draft(client: TestClient, token: str, **overrides: object) -> dict:
    response = client.post(
        "/api/v1/practice/drafts",
        headers=auth_header(token),
        json=_payload(**overrides),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_draft_crud_versioning_and_delete(client: TestClient) -> None:
    body = register(client, email="practice-draft@example.com")
    token = body["access_token"]
    draft = _create_draft(client, token)

    assert draft["version"] == 1
    assert draft["file_name"] == "solution.py"
    assert draft["line_count"] == 3
    assert draft["self_test"]["passed"] == 3
    assert draft["task_context"] is None

    updated = client.patch(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers=auth_header(token),
        json={"version": 1, "problem_title": "两数之和（更新）"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["version"] == 2
    assert updated.json()["problem_title"] == "两数之和（更新）"
    assert updated.json()["problem_source"] == "LeetCode 1"

    stale = client.patch(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers=auth_header(token),
        json={"version": 1, "problem_title": "过期"},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "VERSION_CONFLICT"

    mismatch = client.patch(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers={**auth_header(token), "If-Match": '"1"'},
        json={"version": 2, "problem_title": "版本不一致"},
    )
    assert mismatch.status_code == 400
    assert mismatch.json()["error"]["code"] == "VERSION_MISMATCH"

    deleted = client.delete(
        f"/api/v1/practice/drafts/{draft['id']}?version=2",
        headers=auth_header(token),
    )
    assert deleted.status_code == 204
    missing = client.get(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers=auth_header(token),
    )
    assert missing.status_code == 404


def test_draft_submit_requires_consent_and_is_immutable(client: TestClient) -> None:
    body = register(client, email="practice-submit@example.com")
    token = body["access_token"]
    draft = _create_draft(client, token, file_name="solution.py")

    no_consent = client.post(
        f"/api/v1/practice/drafts/{draft['id']}/submit",
        headers=auth_header(token),
        json={"version": 1},
    )
    assert no_consent.status_code == 403
    assert no_consent.json()["error"]["code"] == "AI_CONSENT_REQUIRED"

    _grant_code_consent(client, token)
    submitted = client.post(
        f"/api/v1/practice/drafts/{draft['id']}/submit",
        headers=auth_header(token),
        json={"version": 1},
    )
    assert submitted.status_code == 201, submitted.text
    data = submitted.json()
    assert data["draft_id"] == draft["id"]
    assert data["review_status"] == "not_started"
    assert data["consent_scope"] == "ai_code_review"
    assert data["consent_version"] == "v1"
    assert data["code_hash"] == draft["code_hash"]
    assert data["self_test"]["passed"] == 3

    detail = client.get(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers=auth_header(token),
    )
    assert detail.status_code == 200
    assert detail.json()["status"] == "submitted"
    assert detail.json()["last_submission_id"] == data["id"]

    update = client.patch(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers=auth_header(token),
        json={"version": 2, "problem_title": "不能再改"},
    )
    assert update.status_code == 409
    assert update.json()["error"]["code"] == "DRAFT_ALREADY_SUBMITTED"

    repeat = client.post(
        f"/api/v1/practice/drafts/{draft['id']}/submit",
        headers=auth_header(token),
        json={"version": 2},
    )
    assert repeat.status_code == 409
    assert repeat.json()["error"]["code"] == "DRAFT_ALREADY_SUBMITTED"


def test_direct_submission_is_idempotent(client: TestClient) -> None:
    body = register(client, email="practice-direct@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    headers = {
        **auth_header(token),
        "Idempotency-Key": "practice-submit-1",
    }

    first = client.post(
        "/api/v1/practice/submissions",
        headers=headers,
        json=_payload(),
    )
    assert first.status_code == 201, first.text
    second = client.post(
        "/api/v1/practice/submissions",
        headers=headers,
        json=_payload(),
    )
    assert second.status_code == 201, second.text
    assert second.headers["idempotency-replayed"] == "true"
    assert second.json() == first.json()

    listing = client.get(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
    )
    assert listing.json()["total"] == 1


def test_self_test_and_file_name_validation(client: TestClient) -> None:
    body = register(client, email="practice-validation@example.com")
    token = body["access_token"]

    passed_gt_total = client.post(
        "/api/v1/practice/drafts",
        headers=auth_header(token),
        json=_payload(
            self_test={"provided": True, "passed": 4, "total": 3, "failures": []}
        ),
    )
    assert passed_gt_total.status_code == 422
    assert passed_gt_total.json()["error"]["code"] == "VALIDATION_ERROR"

    fake_counts = client.post(
        "/api/v1/practice/drafts",
        headers=auth_header(token),
        json=_payload(
            self_test={"provided": False, "passed": 1, "total": 3, "failures": []}
        ),
    )
    assert fake_counts.status_code == 422

    bad_extension = client.post(
        "/api/v1/practice/drafts",
        headers=auth_header(token),
        json=_payload(file_name="solution.js"),
    )
    assert bad_extension.status_code == 422
    assert bad_extension.json()["error"]["code"] == "INVALID_FILE_NAME"

    path_name = client.post(
        "/api/v1/practice/drafts",
        headers=auth_header(token),
        json=_payload(file_name="../solution.py"),
    )
    assert path_name.status_code == 422
    assert path_name.json()["error"]["code"] == "INVALID_FILE_NAME"

    too_large = client.post(
        "/api/v1/practice/drafts",
        headers=auth_header(token),
        json=_payload(code_text="中" * 204800),
    )
    assert too_large.status_code == 413
    assert too_large.json()["error"]["code"] == "CODE_TOO_LARGE"

    draft = _create_draft(client, token)
    null_language = client.patch(
        f"/api/v1/practice/drafts/{draft['id']}",
        headers=auth_header(token),
        json={"version": 1, "language": None},
    )
    assert null_language.status_code == 422
    assert null_language.json()["error"]["code"] == "VALIDATION_ERROR"


def test_task_context_and_copy(client: TestClient) -> None:
    body = register(client, email="practice-task@example.com")
    token = body["access_token"]
    _grant_code_consent(client, token)
    route, task = prepare_route(client, token)

    context = client.get(
        f"/api/v1/practice/context?task_id={task['id']}",
        headers=auth_header(token),
    )
    assert context.status_code == 200, context.text
    task_context = context.json()["task_context"]
    assert task_context["task_id"] == task["id"]
    assert task_context["route_title"] == route["title"]
    assert task_context["stage_name"] == "基础夯实"
    assert task_context["week_focus"] == "网络基础"

    submitted = client.post(
        "/api/v1/practice/submissions",
        headers=auth_header(token),
        json=_payload(task_id=task["id"], capability_codes=[]),
    )
    assert submitted.status_code == 201, submitted.text
    data = submitted.json()
    assert data["task_id"] == task["id"]
    assert "network.tcp" in data["capability_codes"]
    assert data["task_context"]["route_title"] == route["title"]

    copied = client.post(
        f"/api/v1/practice/submissions/{data['id']}/copy-to-draft",
        headers=auth_header(token),
    )
    assert copied.status_code == 201, copied.text
    assert copied.json()["source_submission_id"] == data["id"]
    assert copied.json()["code_text"] == data["code_text"]
    assert copied.json()["version"] == 1


def test_practice_is_user_isolated(client: TestClient) -> None:
    alice = register(client, email="practice-alice@example.com")
    bob = register(client, email="practice-bob@example.com")
    _grant_code_consent(client, alice["access_token"])
    draft = _create_draft(client, alice["access_token"])
    submitted = client.post(
        f"/api/v1/practice/drafts/{draft['id']}/submit",
        headers=auth_header(alice["access_token"]),
        json={"version": 1},
    )
    assert submitted.status_code == 201

    assert (
        client.get(
            f"/api/v1/practice/drafts/{draft['id']}",
            headers=auth_header(bob["access_token"]),
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/v1/practice/submissions/{submitted.json()['id']}",
            headers=auth_header(bob["access_token"]),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/practice/submissions/{submitted.json()['id']}/copy-to-draft",
            headers=auth_header(bob["access_token"]),
        ).status_code
        == 404
    )


def test_draft_list_pagination(client: TestClient) -> None:
    body = register(client, email="practice-list@example.com")
    token = body["access_token"]
    _create_draft(client, token, problem_title="题一")
    _create_draft(client, token, problem_title="题二")

    page = client.get(
        "/api/v1/practice/drafts?limit=1&offset=0",
        headers=auth_header(token),
    )
    assert page.status_code == 200
    assert page.json()["total"] == 2
    assert len(page.json()["items"]) == 1
    assert page.json()["limit"] == 1

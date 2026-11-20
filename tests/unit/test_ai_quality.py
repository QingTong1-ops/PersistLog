from __future__ import annotations

from app.ai.harness import (
    QualityPolicy,
    ValidationIssue,
    evaluate_quality,
)


def _issue(
    dimension: str,
    severity: str = "error",
) -> ValidationIssue:
    return ValidationIssue(
        code="TEST",
        message="test",
        dimension=dimension,
        severity=severity,
    )


def test_clean_output_is_accepted() -> None:
    report = evaluate_quality([])
    assert report.overall == 1.0
    assert report.decision == "accepted"


def test_grounding_error_requires_review() -> None:
    report = evaluate_quality([_issue("grounding")])
    assert report.grounding < 1.0
    assert report.decision == "needs_review"


def test_safety_error_is_rejected_even_with_high_score() -> None:
    report = evaluate_quality([_issue("safety")])
    assert report.overall > 0.85
    assert report.safety < 1.0
    assert report.decision == "rejected"


def test_schema_failure_is_rejected() -> None:
    report = evaluate_quality([], schema_valid=False)
    assert report.overall == 0.0
    assert report.decision == "rejected"


def test_warning_does_not_force_review() -> None:
    report = evaluate_quality([_issue("grounding", "warning")])
    assert report.decision == "accepted"


def test_custom_thresholds() -> None:
    policy = QualityPolicy(accept_threshold=0.95, review_threshold=0.90)
    report = evaluate_quality([_issue("grounding", "warning")], policy)
    assert report.decision == "accepted"
    assert report.overall < 1.0

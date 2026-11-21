from __future__ import annotations

from app.ai.tasks.code_review import CodeReviewOutput
from app.services.code_review_service import compute_assessment, level_for_score


def _output(
    *,
    correctness: int | None = 63,
    complexity: int | None = 80,
    quality: int | None = 74,
    testing: int | None = 60,
    communication: int | None = 70,
) -> CodeReviewOutput:
    return CodeReviewOutput.model_validate(
        {
            "summary": "静态评审",
            "static_risk": "medium",
            "confidence": 0.8,
            "dimensions": {
                "correctness_risk": {
                    "level": "medium",
                    "score": correctness,
                    "reason": "边界风险",
                    "deductions": [],
                },
                "complexity": {
                    "score": complexity,
                    "reason": "复杂度",
                    "deductions": [],
                },
                "quality": {
                    "score": quality,
                    "reason": "质量",
                    "deductions": [],
                },
                "testing": {
                    "score": testing,
                    "reason": "测试",
                    "deductions": [],
                },
                "communication": {
                    "score": communication,
                    "reason": "表达",
                    "deductions": [],
                },
            },
            "evidence": [],
            "strengths": [],
            "improvements": [],
            "followups": [{"question": "边界？"}],
            "not_evaluated": [],
        }
    )


def test_weighted_score_and_levels() -> None:
    result = compute_assessment(_output(), {"provided": True, "passed": 3, "total": 3})
    assert result.status == "succeeded"
    assert result.score == 69
    assert result.level == "B"
    assert level_for_score(95) == "A+"
    assert level_for_score(85) == "A"
    assert level_for_score(75) == "B+"
    assert level_for_score(65) == "B"
    assert level_for_score(55) == "C+"
    assert level_for_score(45) == "C"
    assert level_for_score(44) == "D"


def test_no_self_test_has_no_total_or_level() -> None:
    result = compute_assessment(_output(), None)
    assert result.status == "not_evaluated"
    assert result.score is None
    assert result.level is None
    assert "correctness_risk" in result.not_evaluated
    assert "testing" in result.not_evaluated


def test_missing_dimension_does_not_produce_total() -> None:
    result = compute_assessment(
        _output(complexity=None),
        {"provided": True, "passed": 3, "total": 3},
    )
    assert result.status == "not_evaluated"
    assert result.score is None
    assert "complexity" in result.not_evaluated

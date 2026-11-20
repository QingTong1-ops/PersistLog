from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.ai.evals import EvalCase, run_eval_cases
from app.core.errors import AppError


class FakeGateway:
    def run(self, spec: Any, payload: Any, *, user: Any) -> Any:
        if payload["decision"] == "rejected":
            raise AppError(
                "AI_OUTPUT_REJECTED",
                "low quality",
                status_code=502,
                details={"quality": {"overall": 0.4}},
            )
        return SimpleNamespace(
            quality=SimpleNamespace(
                decision=payload["decision"],
                overall=0.92,
            )
        )


def test_eval_report_counts_gate_decisions() -> None:
    report = run_eval_cases(
        FakeGateway(),  # type: ignore[arg-type]
        None,  # type: ignore[arg-type]
        [
            EvalCase("good", {"decision": "accepted"}, "accepted"),
            EvalCase("low", {"decision": "rejected"}, "rejected"),
            EvalCase("wrong-expectation", {"decision": "accepted"}, "rejected"),
        ],
        user=SimpleNamespace(),  # type: ignore[arg-type]
    )
    assert report.total == 3
    assert report.passed == 2
    assert report.pass_rate == 2 / 3
    assert not report.all_passed
    rejected = report.results[1]
    assert rejected.actual == "rejected"
    assert rejected.quality == 0.4

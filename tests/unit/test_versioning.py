from __future__ import annotations

import pytest
from app.core.errors import AppError
from app.core.versioning import (
    bump_version,
    ensure_version,
    parse_if_match,
    resolve_expected_version,
)


def test_ensure_version_accepts_match() -> None:
    ensure_version(current=3, expected=3)


def test_ensure_version_requires_version() -> None:
    with pytest.raises(AppError) as exc:
        ensure_version(current=3, expected=None)
    assert exc.value.code == "VERSION_REQUIRED"
    assert exc.value.status_code == 422


def test_ensure_version_reports_conflict() -> None:
    with pytest.raises(AppError) as exc:
        ensure_version(current=4, expected=3)
    assert exc.value.code == "VERSION_CONFLICT"
    assert exc.value.status_code == 409
    assert exc.value.details == {"current_version": 4, "expected_version": 3}


def test_parse_if_match_variants() -> None:
    assert parse_if_match(None) is None
    assert parse_if_match("3") == 3
    assert parse_if_match('"3"') == 3
    assert parse_if_match('W/"3"') == 3


def test_parse_if_match_rejects_invalid() -> None:
    with pytest.raises(AppError) as exc:
        parse_if_match("abc")
    assert exc.value.code == "INVALID_VERSION_HEADER"


def test_resolve_expected_version_rejects_mismatch() -> None:
    with pytest.raises(AppError) as exc:
        resolve_expected_version('"3"', 4)
    assert exc.value.code == "VERSION_MISMATCH"


def test_bump_version() -> None:
    assert bump_version(1) == 2

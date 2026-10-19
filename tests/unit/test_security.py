import pytest
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)


def test_password_hash_and_verify() -> None:
    password_hash = hash_password("password123")
    assert password_hash != "password123"
    assert verify_password("password123", password_hash)
    assert not verify_password("wrong", password_hash)


def test_access_token_round_trip() -> None:
    token = create_access_token("user-1")
    assert decode_access_token(token) == "user-1"


def test_invalid_access_token_raises() -> None:
    with pytest.raises(AppError) as exc:
        decode_access_token("not-a-token")
    assert exc.value.code == "INVALID_TOKEN"


def test_refresh_token_hash_and_expiry() -> None:
    raw, hashed, expires_at = new_refresh_token()
    assert raw
    assert hashed == hash_refresh_token(raw)
    assert expires_at.tzinfo is None

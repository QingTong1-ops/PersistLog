from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.rate_limit import check_rate_limit, request_ip
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(
    access_token: str, refresh_token: str, expires_in: int, user
) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession) -> TokenResponse:
    user = auth_service.register_user(
        db,
        email=str(payload.email),
        password=payload.password,
        display_name=payload.display_name,
        timezone_name=payload.timezone,
    )
    access_token, refresh_token, expires_in = auth_service.issue_token_pair(db, user)
    return _token_response(access_token, refresh_token, expires_in, user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession, request: Request) -> TokenResponse:
    check_rate_limit(f"login:{request_ip(request)}", 5, 60)
    user = auth_service.authenticate_user(
        db, email=str(payload.email), password=payload.password
    )
    access_token, refresh_token, expires_in = auth_service.issue_token_pair(db, user)
    return _token_response(access_token, refresh_token, expires_in, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: DbSession) -> TokenResponse:
    access_token, refresh_token, expires_in, user = auth_service.rotate_refresh_token(
        db, payload.refresh_token
    )
    return _token_response(access_token, refresh_token, expires_in, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, db: DbSession) -> Response:
    auth_service.revoke_refresh_token(db, payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.errors import AppError, error_response
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
settings = get_settings()


def _assert_trusted_origin(request: Request) -> None:
    """Reject cookie-authenticated writes from untrusted browser origins."""
    origin = request.headers.get("origin")
    if origin is None:
        return
    if origin not in settings.cors_origin_list:
        raise AppError("CSRF_ORIGIN_REJECTED", "请求来源不被允许", status_code=403)


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain,
        secure=settings.resolved_refresh_cookie_secure(),
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain,
        secure=settings.resolved_refresh_cookie_secure(),
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _provided_refresh_token(
    request: Request, payload: RefreshRequest | LogoutRequest | None
) -> str | None:
    """Prefer the HttpOnly cookie; keep a body fallback for non-browser clients."""
    return request.cookies.get(settings.refresh_cookie_name) or (
        payload.refresh_token if payload else None
    )


def _token_response(access_token: str, expires_in: int, user) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest, response: Response, db: DbSession
) -> TokenResponse:
    user = auth_service.register_user(
        db,
        email=str(payload.email),
        password=payload.password,
        display_name=payload.display_name,
        timezone_name=payload.timezone,
    )
    access_token, refresh_token, expires_in = auth_service.issue_token_pair(db, user)
    _set_refresh_cookie(response, refresh_token)
    return _token_response(access_token, expires_in, user)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, request: Request, response: Response, db: DbSession
) -> TokenResponse:
    check_rate_limit(f"login:{request_ip(request)}", 5, 60)
    user = auth_service.authenticate_user(
        db, email=str(payload.email), password=payload.password
    )
    access_token, refresh_token, expires_in = auth_service.issue_token_pair(db, user)
    _set_refresh_cookie(response, refresh_token)
    return _token_response(access_token, expires_in, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: DbSession,
    payload: RefreshRequest | None = None,
) -> TokenResponse | Response:
    _assert_trusted_origin(request)
    raw_refresh_token = _provided_refresh_token(request, payload)
    if not raw_refresh_token:
        failed = error_response(
            request,
            code="INVALID_REFRESH_TOKEN",
            message="缺少刷新令牌",
            status_code=401,
        )
        _clear_refresh_cookie(failed)
        return failed
    try:
        access_token, new_refresh_token, expires_in, user = (
            auth_service.rotate_refresh_token(db, raw_refresh_token)
        )
    except AppError as exc:
        # Drop the stale cookie so the browser does not keep replaying it.
        failed = error_response(
            request,
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details,
        )
        _clear_refresh_cookie(failed)
        return failed
    _set_refresh_cookie(response, new_refresh_token)
    return _token_response(access_token, expires_in, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: DbSession,
    payload: LogoutRequest | None = None,
) -> Response:
    _assert_trusted_origin(request)
    raw_refresh_token = _provided_refresh_token(request, payload)
    if raw_refresh_token:
        auth_service.revoke_refresh_token(db, raw_refresh_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)

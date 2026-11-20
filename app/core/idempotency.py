from __future__ import annotations

import json
from typing import Any

from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.db import SessionLocal
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.services import idempotency_service

IDEMPOTENCY_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SENSITIVE_PATH_PREFIXES = ("/api/v1/auth",)
MAX_BODY_BYTES = 5 * 1024 * 1024


class _BodyTooLarge(Exception):
    pass


def _header(scope: Scope, name: bytes) -> bytes | None:
    for key, value in scope.get("headers", []):
        if key.lower() == name:
            return value
    return None


def _request_id(scope: Scope) -> str | None:
    state = scope.get("state") or {}
    return state.get("request_id")


async def _send_error(
    send: Send,
    *,
    scope: Scope,
    status_code: int,
    code: str,
    message: str,
    retryable: bool = False,
) -> None:
    response = JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": None,
                "request_id": _request_id(scope),
                "retryable": retryable,
            }
        },
    )
    await response(scope, _empty_receive, send)


async def _empty_receive() -> Message:
    return {"type": "http.disconnect"}


def _begin_sync(
    *,
    user_id: str,
    key: str,
    method: str,
    path: str,
    request_hash: str,
) -> idempotency_service.IdempotencyStart:
    with SessionLocal() as db:
        return idempotency_service.begin_or_create(
            db,
            user_id=user_id,
            key=key,
            method=method,
            path=path,
            request_hash=request_hash,
        )


def _complete_sync(record_id: str, status_code: int, body: Any) -> None:
    with SessionLocal() as db:
        idempotency_service.complete(
            db,
            record_id,
            status_code=status_code,
            body=body,
        )


def _release_sync(record_id: str) -> None:
    with SessionLocal() as db:
        idempotency_service.release(db, record_id)


class IdempotencyMiddleware:
    """Replay successful JSON write responses for an Idempotency-Key.

    Only JSON requests/responses are covered. Successful (2xx) responses are
    stored; failures release the reservation so the client can retry safely.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method", "").upper() not in IDEMPOTENCY_METHODS:
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path.startswith(SENSITIVE_PATH_PREFIXES):
            await self.app(scope, receive, send)
            return

        raw_key = _header(scope, b"idempotency-key")
        if raw_key is None:
            await self.app(scope, receive, send)
            return

        content_type = (_header(scope, b"content-type") or b"").lower()
        # Multipart bodies contain random boundaries, so their hash is not
        # stable across retries. Keep idempotency for JSON (and empty-body
        # DELETE) requests; imports remain covered by their own state checks.
        if content_type and b"application/json" not in content_type:
            await self.app(scope, receive, send)
            return

        try:
            key = idempotency_service.validate_key(raw_key.decode("utf-8"))
        except (UnicodeDecodeError, AppError) as exc:
            code = exc.code if isinstance(exc, AppError) else "INVALID_IDEMPOTENCY_KEY"
            message = (
                exc.message
                if isinstance(exc, AppError)
                else "Idempotency-Key 必须为 1–128 个字符"
            )
            await _send_error(
                send,
                scope=scope,
                status_code=400,
                code=code,
                message=message,
            )
            return

        raw_auth = _header(scope, b"authorization") or b""
        if not raw_auth.lower().startswith(b"bearer "):
            await self.app(scope, receive, send)
            return
        try:
            user_id = decode_access_token(raw_auth[7:].decode("utf-8"))
        except (UnicodeDecodeError, AppError):
            # Let the auth dependency produce the canonical 401 response.
            await self.app(scope, receive, send)
            return

        try:
            body = await _read_body(receive)
        except _BodyTooLarge:
            await _send_error(
                send,
                scope=scope,
                status_code=413,
                code="REQUEST_TOO_LARGE",
                message="请求体超过幂等处理上限",
            )
            return
        if body is None:
            return

        method = scope.get("method", "").upper()
        request_hash = idempotency_service.hash_request(
            method,
            path,
            scope.get("query_string", b""),
            body,
        )
        try:
            start = await run_in_threadpool(
                _begin_sync,
                user_id=user_id,
                key=key,
                method=method,
                path=path,
                request_hash=request_hash,
            )
        except AppError as exc:
            await _send_error(
                send,
                scope=scope,
                status_code=exc.status_code,
                code=exc.code,
                message=exc.message,
                retryable=exc.retryable,
            )
            return

        if start.replay is not None:
            await _send_replay(scope, send, start.replay)
            return

        record_id = start.record_id
        captured: dict[str, Any] = {
            "status": 500,
            "headers": [],
            "body": b"",
        }

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                captured["status"] = int(message["status"])
                captured["headers"] = list(message.get("headers", []))
            elif message["type"] == "http.response.body":
                captured["body"] += message.get("body", b"")
                if message.get("more_body", False):
                    return
                await send(
                    {
                        "type": "http.response.start",
                        "status": captured["status"],
                        "headers": captured["headers"],
                    }
                )
                await send(
                    {
                        "type": "http.response.body",
                        "body": captured["body"],
                        "more_body": False,
                    }
                )
            else:
                await send(message)

        try:
            await self.app(scope, _body_receive(body), send_wrapper)
        except Exception:
            if record_id is not None:
                await run_in_threadpool(_release_sync, record_id)
            raise

        status_code = int(captured["status"])
        response_body = captured["body"]
        if (
            record_id is not None
            and 200 <= status_code < 300
            and not _has_set_cookie(captured["headers"])
        ):
            if status_code == 204:
                await run_in_threadpool(_complete_sync, record_id, status_code, None)
            elif b"application/json" in _response_content_type(captured["headers"]):
                try:
                    payload = json.loads(response_body) if response_body else None
                except json.JSONDecodeError:
                    await run_in_threadpool(_release_sync, record_id)
                else:
                    await run_in_threadpool(
                        _complete_sync,
                        record_id,
                        status_code,
                        payload,
                    )
            else:
                await run_in_threadpool(_release_sync, record_id)
        elif record_id is not None:
            await run_in_threadpool(_release_sync, record_id)


def _response_content_type(headers: list[tuple[bytes, bytes]]) -> bytes:
    for key, value in headers:
        if key.lower() == b"content-type":
            return value.lower()
    return b""


def _has_set_cookie(headers: list[tuple[bytes, bytes]]) -> bool:
    return any(key.lower() == b"set-cookie" for key, _ in headers)


async def _read_body(receive: Receive) -> bytes | None:
    chunks: list[bytes] = []
    total = 0
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            return None
        if message["type"] != "http.request":
            continue
        chunk = message.get("body", b"")
        chunks.append(chunk)
        total += len(chunk)
        if total > MAX_BODY_BYTES:
            raise _BodyTooLarge
        if not message.get("more_body", False):
            return b"".join(chunks)


def _body_receive(body: bytes) -> Receive:
    sent = False

    async def receive() -> Message:
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    return receive


async def _send_replay(
    scope: Scope,
    send: Send,
    replay: idempotency_service.IdempotencyReplay,
) -> None:
    if replay.status_code == 204:
        response = Response(status_code=replay.status_code)
    else:
        response = JSONResponse(
            status_code=replay.status_code,
            content=replay.body,
        )
    response.headers["Idempotency-Replayed"] = "true"

    async def _scope_send(message: Message) -> None:
        await send(message)

    await response(scope, _empty_receive, _scope_send)

from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import Request
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.errors import AppError


class MemoryRateLimiter:
    def __init__(self) -> None:
        self._events: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            events = [value for value in self._events[key] if value > cutoff]
            self._events[key] = events
            if len(events) >= limit:
                retry_after = max(int(window_seconds - (now - events[0])) + 1, 1)
                return False, retry_after
            events.append(now)
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


class RedisRateLimiter:
    def __init__(self, client: Redis) -> None:
        self.client = client
        self.fallback = MemoryRateLimiter()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        try:
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.ttl(key)
            count, ttl = pipe.execute()
            if int(count) == 1 or int(ttl) < 0:
                self.client.expire(key, window_seconds)
                ttl = window_seconds
            if int(count) > limit:
                return False, max(int(ttl), 1)
            return True, 0
        except RedisError:
            return self.fallback.hit(key, limit, window_seconds)

    def reset(self) -> None:
        self.fallback.reset()


_limiter: MemoryRateLimiter | RedisRateLimiter | None = None
_limiter_lock = threading.Lock()


def get_limiter() -> MemoryRateLimiter | RedisRateLimiter:
    global _limiter
    if _limiter is not None:
        return _limiter
    with _limiter_lock:
        if _limiter is not None:
            return _limiter
        settings = get_settings()
        if settings.app_env == "test":
            _limiter = MemoryRateLimiter()
            return _limiter
        try:
            client = Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=0.2,
                socket_timeout=0.2,
            )
            client.ping()
            _limiter = RedisRateLimiter(client)
        except RedisError:
            _limiter = MemoryRateLimiter()
        return _limiter


def reset_rate_limits() -> None:
    global _limiter
    with _limiter_lock:
        if _limiter is not None:
            _limiter.reset()
        _limiter = None


def check_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    allowed, retry_after = get_limiter().hit(
        f"ratelimit:{key}", limit, window_seconds
    )
    if not allowed:
        raise AppError(
            "RATE_LIMITED",
            "请求过于频繁，请稍后再试",
            status_code=429,
            details={"retry_after": retry_after},
        )


def request_ip(request: Request) -> str:
    if request.client is None:
        return "unknown"
    return request.client.host

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "恒序 persistLog"
    app_env: Literal["dev", "test", "prod"] = "dev"
    debug: bool = False
    version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "mysql+pymysql://root@127.0.0.1:3306/persistlog?charset=utf8mb4"
    test_database_url: str | None = None
    database_echo: bool = False
    database_pool_size: int = 5
    database_pool_recycle: int = 1800

    redis_url: str = "redis://127.0.0.1:6379/0"

    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 30

    encryption_key: str = ""

    ai_provider: str = "stub"
    ai_api_key: str = Field(default="", repr=False)
    ai_model: str = ""
    ai_base_url: str = ""

    notification_provider: str = "wecom"
    web_base_url: str = "http://localhost:3000"

    # Comma-separated browser origins allowed to call the API with credentials.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    refresh_cookie_name: str = "persistlog_refresh"
    refresh_cookie_secure: bool | None = None
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    refresh_cookie_domain: str | None = None

    storage_backend: str = "local"
    storage_dir: str = "storage"
    max_upload_bytes: int = 5 * 1024 * 1024

    timezone: str = "Asia/Shanghai"
    day_boundary_hour: int = 4

    def resolved_database_url(self) -> str:
        """Return the test DB URL when running tests, otherwise the main DB URL."""
        if self.app_env == "test" and self.test_database_url:
            return self.test_database_url
        return self.database_url

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the configured CORS origins without empty entries."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def refresh_cookie_path(self) -> str:
        """Limit the refresh cookie to the authentication endpoints."""
        return f"{self.api_v1_prefix.rstrip('/')}/auth"

    def resolved_refresh_cookie_secure(self) -> bool:
        """Require HTTPS for the refresh cookie unless explicitly overridden."""
        if self.refresh_cookie_secure is not None:
            return self.refresh_cookie_secure
        return self.app_env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()

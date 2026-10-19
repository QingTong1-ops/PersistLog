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


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Aegis AI"
    environment: str = "development"

    # Database: PostgreSQL in demo/production, SQLite for local unit tests.
    database_url: str = "postgresql+asyncpg://aegis:aegis@localhost:5432/aegis"

    # Demo tuning
    jit_default_ttl_seconds: int = 300
    approval_ttl_seconds: int = 900
    rate_limit_per_minute: int = 5

    # Deterministic risk threshold at which human approval is required.
    approval_risk_threshold: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()

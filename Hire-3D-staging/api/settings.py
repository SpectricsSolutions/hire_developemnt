from __future__ import annotations

import enum

import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import SecretStr


@enum.unique
class ENVIRONMENT(enum.StrEnum):
    DEVELOPMENT = "DEVELOPMENT"
    PRODUCTION = "PRODUCTION"
    STAGING = "STAGING"
    TESTING = "TESTING"


class DatabaseSettings(BaseSettings):
    DB_HOST: str
    DB_PORT: int = 5432
    DB_USERNAME: str
    DB_PASSWORD: SecretStr
    DB_NAME: str

    POOL_SIZE: int = 5
    MAX_OVERFLOW: int = 10
    POOL_TIMEOUT: int = 30  # seconds
    POOL_RECYCLE: int = 1800  # seconds

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USERNAME}:"
            f"{self.DB_PASSWORD.get_secret_value()}@"
            f"{self.DB_HOST}:{self.DB_PORT}/"
            f"{self.DB_NAME}"
        )


class AppSettings(BaseSettings):
    PROJECT_NAME: str = "Hire 3D"
    PROJECT_DESCRIPTION: str = "API for Hire 3D"
    PROJECT_VERSION: str = "1.0.0"

    DEBUG: bool = False
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    ENVIRONMENT: ENVIRONMENT = ENVIRONMENT.PRODUCTION

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == ENVIRONMENT.PRODUCTION

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == ENVIRONMENT.DEVELOPMENT

    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == ENVIRONMENT.TESTING


class AuthSettings(BaseSettings):
    JWT_SECRET: SecretStr
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15

    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    TOTP_TOKEN_EXPIRE_MINUTES: int = 5
    TOTP_REQUIRED_ROLES: list[str] = ["ADMIN"]
    TOTP_ISSUER: str = "Hire3D"

    LOGIN_RATE_LIMIT_PER_MINUTE: int = 5


class Settings(AppSettings, DatabaseSettings, AuthSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


def _env_file() -> Path:
    base = Path(__file__).resolve().parent
    if os.getenv("ENVIRONMENT") == ENVIRONMENT.TESTING:
        return base / ".env.test"
    return base.parent / ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings(_env_file=_env_file())  # noqa

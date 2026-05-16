from __future__ import annotations

from datetime import timedelta
from unittest.mock import MagicMock
from uuid import uuid4

import pyotp
from argon2 import PasswordHasher

from auth.models import RefreshToken, UserTOTP
from common.datetime import get_utc_now
from settings import Settings
from users.models import User
from users.types import UserMeta, UserStatus

_ph = PasswordHasher()


def make_settings() -> Settings:
    return Settings(
        DB_HOST="localhost",
        DB_USERNAME="postgres",
        DB_PASSWORD="postgres",
        DB_NAME="hire3d_test",
        JWT_SECRET="test-secret",
        ENVIRONMENT="TESTING",
    )


def make_user(status: UserStatus = UserStatus.ACTIVE) -> User:
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.name = "Test User"
    user.email = "user@example.com"
    user.role = None
    user.role_id = None
    user.status = status
    user.password = _ph.hash("secret")
    user.meta = UserMeta()
    user.permissions = set()
    return user


def make_refresh_token(user_id=None, revoked_at=None, expires_at=None) -> RefreshToken:
    token = MagicMock(spec=RefreshToken)
    token.id = uuid4()
    token.token = uuid4()
    token.user_id = user_id or uuid4()
    token.revoked_at = revoked_at
    token.expires_at = expires_at or (get_utc_now() + timedelta(days=7))
    return token


def make_totp_record(*, secret: str | None = None, is_enabled: bool = True) -> UserTOTP:
    record = MagicMock(spec=UserTOTP)
    record.secret = secret or pyotp.random_base32()
    record.is_enabled = is_enabled
    return record

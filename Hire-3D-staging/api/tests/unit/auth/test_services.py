from __future__ import annotations

from datetime import timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pyotp
import pytest

from auth.services import AuthService, decode_access_token
from common.datetime import get_utc_now
from common.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from settings import Settings
from users.types import UserStatus
from tests.unit.auth.helpers import (
    make_refresh_token,
    make_totp_record,
    make_user,
)


@pytest.fixture
def store():
    s = AsyncMock()
    s.get_permissions_for_user.return_value = []
    return s


@pytest.fixture
def audit_service():
    return AsyncMock()


@pytest.fixture
def service(store, settings, audit_service):
    return AuthService(store=store, settings=settings, audit_service=audit_service)


class TestLogin:
    async def test_success(self, service, store):
        user = make_user()
        store.get_user_by_email.return_value = user
        store.get_user_totp.return_value = None
        store.create_refresh_token.return_value = make_refresh_token(user_id=user.id)

        result = await service.login("user@example.com", "secret")

        assert result.access_token
        assert result.refresh_token
        store.create_refresh_token.assert_called_once()

    async def test_user_not_found(self, service, store):
        store.get_user_by_email.return_value = None

        with pytest.raises(UnauthorizedError):
            await service.login("missing@example.com", "secret")

    async def test_wrong_password(self, service, store):
        store.get_user_by_email.return_value = make_user()

        with pytest.raises(UnauthorizedError):
            await service.login("user@example.com", "wrong")

    async def test_inactive_user(self, service, store):
        store.get_user_by_email.return_value = make_user(status=UserStatus.INACTIVE)

        with pytest.raises(UnauthorizedError):
            await service.login("user@example.com", "secret")

    async def test_pending_user(self, service, store):
        store.get_user_by_email.return_value = make_user(status=UserStatus.PENDING)

        with pytest.raises(ForbiddenError):
            await service.login("user@example.com", "secret")


class TestLoginWithTOTP:
    async def test_returns_challenge_when_totp_enabled(self, service, store):
        user = make_user()
        store.get_user_by_email.return_value = user
        store.get_user_totp.return_value = make_totp_record(is_enabled=True)

        result = await service.login("user@example.com", "secret")

        assert result.requires_2fa is True
        assert result.totp_token
        store.create_refresh_token.assert_not_called()

    async def test_returns_tokens_when_totp_not_enrolled(self, service, store):
        user = make_user()
        store.get_user_by_email.return_value = user
        store.get_user_totp.return_value = make_totp_record(is_enabled=False)
        store.create_refresh_token.return_value = make_refresh_token(user_id=user.id)

        result = await service.login("user@example.com", "secret")

        assert result.access_token
        assert result.refresh_token


class TestRefresh:
    async def test_success(self, service, store):
        user = make_user()
        token = make_refresh_token(user_id=user.id)
        store.get_refresh_token.return_value = token
        store.get_user_by_id.return_value = user
        store.get_user_totp.return_value = None

        result = await service.refresh(str(token.token))

        assert result.access_token
        store.update_last_used.assert_called_once_with(token.id)

    async def test_invalid_uuid(self, service):
        with pytest.raises(UnauthorizedError):
            await service.refresh("not-a-uuid")

    async def test_token_not_found(self, service, store):
        store.get_refresh_token.return_value = None

        with pytest.raises(UnauthorizedError):
            await service.refresh(str(uuid4()))

    async def test_token_revoked(self, service, store):
        store.get_refresh_token.return_value = make_refresh_token(
            revoked_at=get_utc_now()
        )

        with pytest.raises(UnauthorizedError):
            await service.refresh(str(uuid4()))

    async def test_token_expired(self, service, store):
        store.get_refresh_token.return_value = make_refresh_token(
            expires_at=get_utc_now() - timedelta(days=1)
        )

        with pytest.raises(UnauthorizedError):
            await service.refresh(str(uuid4()))

    async def test_user_inactive(self, service, store):
        user = make_user(status=UserStatus.INACTIVE)
        token = make_refresh_token(user_id=user.id)
        store.get_refresh_token.return_value = token
        store.get_user_by_id.return_value = user

        with pytest.raises(UnauthorizedError):
            await service.refresh(str(token.token))


class TestLogout:
    async def test_success(self, service, store):
        token = make_refresh_token()
        store.get_refresh_token.return_value = token

        await service.logout(str(token.token))

        store.revoke_refresh_token.assert_called_once_with(token.id)

    async def test_invalid_uuid_is_silent(self, service, store):
        await service.logout("not-a-uuid")
        store.get_refresh_token.assert_not_called()

    async def test_already_revoked(self, service, store):
        store.get_refresh_token.return_value = make_refresh_token(
            revoked_at=get_utc_now()
        )

        await service.logout(str(uuid4()))

        store.revoke_refresh_token.assert_not_called()


class TestRevokeUserSessions:
    async def test_revokes_all_tokens(self, service, store):
        user = make_user()
        store.get_user_by_id.return_value = user

        await service.revoke_user_sessions(user.id)

        store.revoke_all_user_tokens.assert_called_once_with(user.id)

    async def test_raises_not_found_for_unknown_user(self, service, store):
        store.get_user_by_id.return_value = None

        with pytest.raises(NotFoundError):
            await service.revoke_user_sessions(uuid4())

    async def test_logs_logout_audit(self, service, store, audit_service):
        user = make_user()
        store.get_user_by_id.return_value = user

        await service.revoke_user_sessions(user.id)

        audit_service.log_logout.assert_called_once_with()


class TestSetupTOTP:
    async def test_returns_qr_uri(self, service, store):
        user = make_user()
        store.upsert_user_totp.return_value = None

        result = await service.setup_totp(user)

        assert result.qr_uri.startswith("otpauth://totp/")
        assert result.issuer == "Hire3D"
        store.upsert_user_totp.assert_called_once()

    async def test_qr_uri_contains_user_email(self, service, store):
        user = make_user()
        store.upsert_user_totp.return_value = None

        result = await service.setup_totp(user)

        assert (
            "user%40example.com" in result.qr_uri or "user@example.com" in result.qr_uri
        )


class TestDisableTOTP:
    async def test_success(self, service, store):
        user = make_user()
        store.get_user_totp.return_value = make_totp_record(is_enabled=True)

        await service.disable_totp(user)

        store.delete_user_totp.assert_called_once_with(user.id)

    async def test_raises_not_found_when_not_enrolled(self, service, store):
        store.get_user_totp.return_value = None

        with pytest.raises(NotFoundError):
            await service.disable_totp(make_user())

    async def test_raises_not_found_when_not_enabled(self, service, store):
        store.get_user_totp.return_value = make_totp_record(is_enabled=False)

        with pytest.raises(NotFoundError):
            await service.disable_totp(make_user())


class TestVerifyTOTP:
    async def test_success(self, service, store):
        secret = pyotp.random_base32()
        user = make_user()
        store.get_user_totp.return_value = make_totp_record(secret=secret)

        await service.verify_totp(user, pyotp.TOTP(secret).now())

        store.enable_user_totp.assert_called_once_with(user.id)

    async def test_invalid_code(self, service, store):
        store.get_user_totp.return_value = make_totp_record()

        with pytest.raises(UnauthorizedError):
            await service.verify_totp(make_user(), "000000")

    async def test_no_totp_record(self, service, store):
        store.get_user_totp.return_value = None

        with pytest.raises(UnauthorizedError):
            await service.verify_totp(make_user(), "123456")


class TestConfirmTOTP:
    async def test_success(self, service, store):
        secret = pyotp.random_base32()
        user = make_user()
        store.get_user_by_id.return_value = user
        store.get_user_totp.return_value = make_totp_record(
            secret=secret, is_enabled=True
        )
        store.create_refresh_token.return_value = make_refresh_token(user_id=user.id)

        result = await service.confirm_totp(
            service._issue_totp_token(user),
            pyotp.TOTP(secret).now(),
        )

        assert result.access_token
        assert result.refresh_token

    async def test_invalid_totp_token(self, service):
        with pytest.raises(UnauthorizedError):
            await service.confirm_totp("not.a.token", "123456")

    async def test_wrong_code(self, service, store):
        user = make_user()
        store.get_user_by_id.return_value = user
        store.get_user_totp.return_value = make_totp_record(is_enabled=True)

        with pytest.raises(UnauthorizedError):
            await service.confirm_totp(service._issue_totp_token(user), "000000")

    async def test_totp_not_enabled(self, service, store):
        user = make_user()
        store.get_user_by_id.return_value = user
        store.get_user_totp.return_value = make_totp_record(is_enabled=False)

        with pytest.raises(UnauthorizedError):
            await service.confirm_totp(service._issue_totp_token(user), "123456")

    async def test_missing_sub_claim(self, service, monkeypatch):
        monkeypatch.setattr(service, "_decode_totp_token", lambda token: {})

        with pytest.raises(UnauthorizedError):
            await service.confirm_totp("totp-token", "123456")

    async def test_inactive_user_is_rejected(self, service, store):
        user = make_user(status=UserStatus.INACTIVE)
        store.get_user_by_id.return_value = user

        with pytest.raises(UnauthorizedError):
            await service.confirm_totp(service._issue_totp_token(user), "123456")

    async def test_wrong_token_type_is_rejected(self, service):
        user = make_user()

        with pytest.raises(UnauthorizedError):
            await service.confirm_totp(service._issue_access_token(user), "123456")


class TestDecodeAccessToken:
    def test_valid_token(self, settings, audit_service):
        user = make_user()
        service = AuthService(
            store=AsyncMock(), settings=settings, audit_service=audit_service
        )
        token = service._issue_access_token(user)

        payload = decode_access_token(token, settings)

        assert payload["sub"] == str(user.id)
        assert payload["role"] == user.role
        assert payload["totp_enabled"] is False

    def test_totp_enabled_claim(self, settings, audit_service):
        user = make_user()
        service = AuthService(
            store=AsyncMock(), settings=settings, audit_service=audit_service
        )
        token = service._issue_access_token(user, totp_enabled=True)

        payload = decode_access_token(token, settings)

        assert payload["totp_enabled"] is True

    def test_invalid_token(self, settings):
        with pytest.raises(UnauthorizedError):
            decode_access_token("invalid.token.here", settings)

    def test_tampered_token(self, settings, audit_service):
        other_settings = Settings(
            DB_HOST="localhost",
            DB_USERNAME="postgres",
            DB_PASSWORD="postgres",
            DB_NAME="hire3d_test",
            JWT_SECRET="different-secret",
            ENVIRONMENT="TESTING",
        )
        service = AuthService(
            store=AsyncMock(), settings=other_settings, audit_service=audit_service
        )
        token = service._issue_access_token(make_user())

        with pytest.raises(UnauthorizedError):
            decode_access_token(token, settings)

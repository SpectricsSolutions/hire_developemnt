from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import Request, Response

from auth.types import (
    AccessTokenResponse,
    IssuedTokens,
    LoginRequest,
    TOTPChallengeResponse,
    TOTPConfirmRequest,
    TOTPSetupResponse,
    TOTPVerifyRequest,
)
from auth.views import (
    _clear_refresh_cookie,
    _login_rate_limit,
    _set_refresh_cookie,
    login,
    logout,
    refresh,
    revoke_sessions,
    totp_confirm,
    totp_disable,
    totp_setup,
    totp_verify,
)


def make_request(
    *,
    path: str,
    cookies: dict[str, str] | None = None,
    method: str = "POST",
) -> Request:
    headers = []
    if cookies:
        headers.append(
            (
                b"cookie",
                "; ".join(f"{key}={value}" for key, value in cookies.items()).encode(),
            )
        )
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": headers,
            "client": ("127.0.0.1", 12345),
        }
    )


@pytest.fixture
def service() -> AsyncMock:
    return AsyncMock()


class TestRefreshCookieHelpers:
    def test_set_refresh_cookie_uses_testing_flags(self, settings):
        response = Response()

        _set_refresh_cookie(response, "refresh-token", settings)

        cookie = response.headers["set-cookie"]
        assert "refresh_token=refresh-token" in cookie
        assert "HttpOnly" in cookie
        assert "SameSite=strict" in cookie
        assert "Secure" not in cookie

    def test_clear_refresh_cookie_sets_delete_header(self):
        response = Response()

        _clear_refresh_cookie(response)

        assert 'refresh_token=""' in response.headers["set-cookie"]


class TestLoginRateLimit:
    def test_uses_settings_value(self):
        assert _login_rate_limit() == "5/minute"


class TestLogin:
    async def test_returns_tokens_and_sets_cookie(self, service, settings):
        service.login.return_value = IssuedTokens("access-token", "refresh-token")
        response = Response()

        result = await login(
            body=LoginRequest(email="user@example.com", password="secret"),
            request=make_request(path="/api/v1/auth/login"),
            response=response,
            service=service,
            settings=settings,
        )

        service.login.assert_awaited_once_with("user@example.com", "secret")
        assert result.data.access_token == "access-token"
        assert "refresh_token=refresh-token" in response.headers["set-cookie"]

    async def test_returns_totp_challenge_without_cookie(self, service, settings):
        service.login.return_value = TOTPChallengeResponse(totp_token="totp-token")
        response = Response()

        result = await login(
            body=LoginRequest(email="user@example.com", password="secret"),
            request=make_request(path="/api/v1/auth/login"),
            response=response,
            service=service,
            settings=settings,
        )

        service.login.assert_awaited_once_with("user@example.com", "secret")
        assert result.data.requires_2fa is True
        assert result.data.totp_token == "totp-token"
        assert "set-cookie" not in response.headers


class TestRefresh:
    async def test_reads_refresh_token_cookie(self, service):
        service.refresh.return_value = AccessTokenResponse(access_token="new-access")

        result = await refresh(
            request=make_request(
                path="/api/v1/auth/refresh",
                cookies={"refresh_token": "refresh-token"},
            ),
            service=service,
        )

        service.refresh.assert_awaited_once_with("refresh-token")
        assert result.data.access_token == "new-access"


class TestLogout:
    async def test_skips_service_without_cookie(self, service):
        response = Response()

        result = await logout(
            request=make_request(path="/api/v1/auth/logout"),
            response=response,
            service=service,
        )

        service.logout.assert_not_awaited()
        assert result.success is True
        assert 'refresh_token=""' in response.headers["set-cookie"]


class TestTOTPSetup:
    async def test_returns_service_result(self, service, current_user):
        service.setup_totp.return_value = TOTPSetupResponse(
            qr_uri="otpauth://totp/test",
            issuer="Hire3D",
        )

        result = await totp_setup(service=service, current_user=current_user)

        service.setup_totp.assert_awaited_once_with(current_user)
        assert result.data.issuer == "Hire3D"


class TestTOTPDisable:
    async def test_calls_service(self, service, current_user):
        result = await totp_disable(service=service, current_user=current_user)

        service.disable_totp.assert_awaited_once_with(current_user)
        assert result.success is True


class TestTOTPVerify:
    async def test_calls_service(self, service, current_user):
        result = await totp_verify(
            body=TOTPVerifyRequest(code="123456"),
            service=service,
            current_user=current_user,
        )

        service.verify_totp.assert_awaited_once_with(current_user, "123456")
        assert result.success is True


class TestRevokeSessions:
    async def test_calls_service(self, service, current_user):
        user_id = uuid4()

        result = await revoke_sessions(user_id=user_id, service=service, _=current_user)

        service.revoke_user_sessions.assert_awaited_once_with(user_id)
        assert result.success is True


class TestTOTPConfirm:
    async def test_sets_cookie(self, service, settings):
        response = Response()
        service.confirm_totp.return_value = IssuedTokens(
            "access-token", "refresh-token"
        )

        result = await totp_confirm(
            body=TOTPConfirmRequest(totp_token="totp-token", code="123456"),
            response=response,
            service=service,
            settings=settings,
        )

        service.confirm_totp.assert_awaited_once_with("totp-token", "123456")
        assert result.data.access_token == "access-token"
        assert "refresh_token=refresh-token" in response.headers["set-cookie"]

from __future__ import annotations

import pyotp
import pytest
from uuid import uuid4

from auth.stores import AuthStore
from tests.factories import make_user, DEFAULT_PASSWORD
from users.types import UserStatus


@pytest.fixture
async def active_user(session):
    return await make_user(session, email="active@example.com")


@pytest.fixture
async def inactive_user(session):
    return await make_user(
        session, email="inactive@example.com", status=UserStatus.INACTIVE
    )


@pytest.fixture
async def pending_user(session):
    return await make_user(
        session, email="pending@example.com", status=UserStatus.PENDING
    )


class TestLogin:
    async def test_success(self, client, active_user):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": active_user.email, "password": DEFAULT_PASSWORD},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["accessToken"]
        assert data["data"]["tokenType"] == "bearer"
        assert "refresh_token" in response.cookies

    async def test_wrong_password(self, client, active_user):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": active_user.email, "password": "wrong"},
        )

        assert response.status_code == 401

    async def test_user_not_found(self, client):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "secret"},
        )

        assert response.status_code == 401

    async def test_inactive_user(self, client, inactive_user):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": inactive_user.email, "password": DEFAULT_PASSWORD},
        )

        assert response.status_code == 401

    async def test_pending_user(self, client, pending_user):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": pending_user.email, "password": DEFAULT_PASSWORD},
        )

        assert response.status_code == 403
        assert "pending approval" in response.json()["message"].lower()

    async def test_missing_email(self, client):
        response = await client.post(
            "/api/v1/auth/login",
            json={"password": "secret"},
        )

        assert response.status_code == 422

    async def test_invalid_email(self, client):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "password": "secret"},
        )

        assert response.status_code == 422


class TestLoginRateLimit:
    async def test_blocks_after_limit_exceeded(self, client, active_user):
        payload = {"email": active_user.email, "password": "wrong"}
        for _ in range(5):
            await client.post("/api/v1/auth/login", json=payload)

        response = await client.post("/api/v1/auth/login", json=payload)
        assert response.status_code == 429

    async def test_rate_limit_response_envelope(self, client, active_user):
        payload = {"email": active_user.email, "password": "wrong"}
        for _ in range(5):
            await client.post("/api/v1/auth/login", json=payload)

        response = await client.post("/api/v1/auth/login", json=payload)
        data = response.json()
        assert data["success"] is False
        assert "message" in data


class TestRefresh:
    async def test_success(self, client, active_user):
        await client.post(
            "/api/v1/auth/login",
            json={"email": active_user.email, "password": DEFAULT_PASSWORD},
        )

        response = await client.post("/api/v1/auth/refresh")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["accessToken"]

    async def test_invalid_token(self, client):
        client.cookies.set("refresh_token", "not-a-uuid")
        response = await client.post("/api/v1/auth/refresh")

        assert response.status_code == 401

    async def test_unknown_token(self, client):
        client.cookies.set("refresh_token", str(uuid4()))
        response = await client.post("/api/v1/auth/refresh")

        assert response.status_code == 401

    async def test_no_cookie_returns_401(self, client):
        response = await client.post("/api/v1/auth/refresh")

        assert response.status_code == 401


class TestLogout:
    async def test_success(self, client, active_user):
        await client.post(
            "/api/v1/auth/login",
            json={"email": active_user.email, "password": DEFAULT_PASSWORD},
        )

        response = await client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        assert response.json()["success"] is True

    async def test_no_cookie_is_silent(self, client):
        response = await client.post("/api/v1/auth/logout")

        assert response.status_code == 200

    async def test_token_unusable_after_logout(self, client, active_user):
        await client.post(
            "/api/v1/auth/login",
            json={"email": active_user.email, "password": DEFAULT_PASSWORD},
        )

        await client.post("/api/v1/auth/logout")

        response = await client.post("/api/v1/auth/refresh")
        assert response.status_code == 401


async def _get_access_token(client, user) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": DEFAULT_PASSWORD},
    )
    return response.json()["data"]["accessToken"]


class TestTOTPSetup:
    async def test_setup_requires_auth(self, client):
        response = await client.post("/api/v1/auth/totp/setup")
        assert response.status_code == 401

    async def test_setup_returns_qr_uri(self, client, active_user):
        access_token = await _get_access_token(client, active_user)

        response = await client.post(
            "/api/v1/auth/totp/setup",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["qrUri"].startswith("otpauth://totp/")
        assert data["data"]["issuer"] == "Hire3D"

    async def test_setup_is_idempotent(self, client, active_user):
        access_token = await _get_access_token(client, active_user)
        headers = {"Authorization": f"Bearer {access_token}"}

        await client.post("/api/v1/auth/totp/setup", headers=headers)
        response = await client.post("/api/v1/auth/totp/setup", headers=headers)

        assert response.status_code == 200


class TestTOTPVerify:
    async def test_verify_enables_totp(self, client, active_user, session):
        access_token = await _get_access_token(client, active_user)
        headers = {"Authorization": f"Bearer {access_token}"}

        setup = await client.post("/api/v1/auth/totp/setup", headers=headers)
        qr_uri = setup.json()["data"]["qrUri"]
        secret = pyotp.parse_uri(qr_uri).secret

        response = await client.post(
            "/api/v1/auth/totp/verify",
            headers=headers,
            json={"code": pyotp.TOTP(secret).now()},
        )

        assert response.status_code == 200
        store = AuthStore(session=session)
        record = await store.get_user_totp(active_user.id)
        assert record is not None
        assert record.is_enabled is True

    async def test_verify_rejects_wrong_code(self, client, active_user):
        access_token = await _get_access_token(client, active_user)
        headers = {"Authorization": f"Bearer {access_token}"}

        await client.post("/api/v1/auth/totp/setup", headers=headers)

        response = await client.post(
            "/api/v1/auth/totp/verify",
            headers=headers,
            json={"code": "000000"},
        )

        assert response.status_code == 401

    async def test_verify_requires_setup_first(self, client, active_user):
        access_token = await _get_access_token(client, active_user)

        response = await client.post(
            "/api/v1/auth/totp/verify",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"code": "123456"},
        )

        assert response.status_code == 401


class TestTOTPConfirm:
    @pytest.fixture
    async def totp_user(self, client, active_user):
        """Active user with TOTP fully enrolled."""
        access_token = await _get_access_token(client, active_user)
        headers = {"Authorization": f"Bearer {access_token}"}

        setup = await client.post("/api/v1/auth/totp/setup", headers=headers)
        qr_uri = setup.json()["data"]["qrUri"]
        secret = pyotp.parse_uri(qr_uri).secret

        await client.post(
            "/api/v1/auth/totp/verify",
            headers=headers,
            json={"code": pyotp.TOTP(secret).now()},
        )

        return active_user, secret

    async def test_login_returns_challenge_when_totp_enabled(self, client, totp_user):
        user, _ = totp_user

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": DEFAULT_PASSWORD},
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["requires2Fa"] is True
        assert data["totpToken"]

    async def test_confirm_with_valid_code(self, client, totp_user):
        user, secret = totp_user

        login = await client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": DEFAULT_PASSWORD},
        )
        totp_token = login.json()["data"]["totpToken"]

        response = await client.post(
            "/api/v1/auth/totp/confirm",
            json={"totpToken": totp_token, "code": pyotp.TOTP(secret).now()},
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["accessToken"]
        assert "refresh_token" in response.cookies

    async def test_confirm_with_wrong_code(self, client, totp_user):
        user, _ = totp_user

        login = await client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": DEFAULT_PASSWORD},
        )
        totp_token = login.json()["data"]["totpToken"]

        response = await client.post(
            "/api/v1/auth/totp/confirm",
            json={"totpToken": totp_token, "code": "000000"},
        )

        assert response.status_code == 401

    async def test_confirm_with_invalid_totp_token(self, client):
        response = await client.post(
            "/api/v1/auth/totp/confirm",
            json={"totpToken": "not.a.token", "code": "123456"},
        )

        assert response.status_code == 401


class TestTOTPDisable:
    @pytest.fixture
    async def enrolled_user(self, client, active_user):
        access_token = await _get_access_token(client, active_user)
        headers = {"Authorization": f"Bearer {access_token}"}

        setup = await client.post("/api/v1/auth/totp/setup", headers=headers)
        secret = pyotp.parse_uri(setup.json()["data"]["qrUri"]).secret

        await client.post(
            "/api/v1/auth/totp/verify",
            headers=headers,
            json={"code": pyotp.TOTP(secret).now()},
        )

        return active_user, access_token

    async def test_disable_requires_auth(self, client):
        response = await client.delete("/api/v1/auth/totp")
        assert response.status_code == 401

    async def test_disable_success(self, client, enrolled_user):
        user, access_token = enrolled_user

        response = await client.delete(
            "/api/v1/auth/totp",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        login = await client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": DEFAULT_PASSWORD},
        )
        assert login.json()["data"].get("requires2Fa") is not True

    async def test_disable_when_not_enrolled(self, client, active_user):
        access_token = await _get_access_token(client, active_user)

        response = await client.delete(
            "/api/v1/auth/totp",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert response.status_code == 404


class TestRevokeUserSessions:
    @pytest.fixture
    async def admin_user(self, session):
        return await make_user(session, email="admin@example.com", role="ADMIN")

    @pytest.fixture
    async def target_user(self, session):
        return await make_user(session, email="target@example.com")

    async def test_admin_can_revoke_user_sessions(
        self, client, admin_user, target_user
    ):
        # Get admin token first so target_user's login sets the final cookie
        admin_token = await _get_access_token(client, admin_user)

        # Login as target_user — their refresh cookie is now in the client jar
        await client.post(
            "/api/v1/auth/login",
            json={"email": target_user.email, "password": DEFAULT_PASSWORD},
        )

        response = await client.delete(
            f"/api/v1/auth/sessions/{target_user.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

        # Cookie is still in jar but the token has been revoked server-side
        refresh = await client.post("/api/v1/auth/refresh")
        assert refresh.status_code == 401

    async def test_non_admin_cannot_revoke_sessions(
        self, client, active_user, target_user
    ):
        token = await _get_access_token(client, active_user)

        response = await client.delete(
            f"/api/v1/auth/sessions/{target_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unauthenticated_cannot_revoke_sessions(self, client, target_user):
        response = await client.delete(f"/api/v1/auth/sessions/{target_user.id}")

        assert response.status_code == 401

    async def test_returns_404_for_unknown_user(self, client, admin_user):
        admin_token = await _get_access_token(client, admin_user)
        response = await client.delete(
            f"/api/v1/auth/sessions/{uuid4()}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert response.status_code == 404

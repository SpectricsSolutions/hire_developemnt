from __future__ import annotations

from uuid import uuid4

import pytest

from tests.factories import make_user, DEFAULT_PASSWORD


@pytest.fixture
async def admin_user(session):
    return await make_user(session, email="admin@example.com", role="ADMIN")


@pytest.fixture
async def regular_user(session):
    return await make_user(session, email="user@example.com", role="VIEWER")


@pytest.fixture
async def other_user(session):
    return await make_user(session, email="other@example.com", role="VIEWER")


async def _get_token(client, user) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": DEFAULT_PASSWORD},
    )
    return response.json()["data"]["accessToken"]


class TestCreateUser:
    async def test_success(self, client):
        response = await client.post(
            "/api/v1/users",
            json={
                "name": "New User",
                "email": "new@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "new@example.com"
        assert data["data"]["name"] == "New User"
        assert data["data"]["status"] == "PENDING"
        assert data["data"]["role"] is None

    async def test_duplicate_email(self, client, session):
        await make_user(session, email="existing@example.com")

        response = await client.post(
            "/api/v1/users",
            json={
                "name": "Another",
                "email": "existing@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 409

    async def test_invalid_email(self, client):
        response = await client.post(
            "/api/v1/users",
            json={"name": "User", "email": "not-an-email", "password": "password123"},
        )

        assert response.status_code == 422

    async def test_short_password(self, client):
        response = await client.post(
            "/api/v1/users",
            json={"name": "User", "email": "user@example.com", "password": "short"},
        )

        assert response.status_code == 422

    async def test_missing_name(self, client):
        response = await client.post(
            "/api/v1/users",
            json={"email": "user@example.com", "password": "password123"},
        )

        assert response.status_code == 422


class TestListUsers:
    async def test_admin_can_list(self, client, admin_user, regular_user):
        token = await _get_token(client, admin_user)

        response = await client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 2

    async def test_non_admin_is_forbidden(self, client, regular_user):
        token = await _get_token(client, regular_user)

        response = await client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unauthenticated_is_401(self, client):
        response = await client.get("/api/v1/users")
        assert response.status_code == 401


class TestGetUser:
    async def test_admin_can_get_any_user(self, client, admin_user, regular_user):
        token = await _get_token(client, admin_user)

        response = await client.get(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["email"] == regular_user.email

    async def test_user_can_get_self(self, client, regular_user):
        token = await _get_token(client, regular_user)

        response = await client.get(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200

    async def test_user_cannot_get_other(self, client, regular_user, other_user):
        token = await _get_token(client, regular_user)

        response = await client.get(
            f"/api/v1/users/{other_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unknown_user_returns_404(self, client, admin_user):
        token = await _get_token(client, admin_user)

        response = await client.get(
            f"/api/v1/users/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

    async def test_unauthenticated_is_401(self, client, regular_user):
        response = await client.get(f"/api/v1/users/{regular_user.id}")
        assert response.status_code == 401


class TestUpdateUser:
    async def test_user_can_update_own_name(self, client, regular_user):
        token = await _get_token(client, regular_user)

        response = await client.patch(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Updated Name"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["name"] == "Updated Name"

    async def test_admin_can_update_role(self, client, admin_user, regular_user):
        token = await _get_token(client, admin_user)

        response = await client.patch(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "OPERATOR"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["role"] == "OPERATOR"

    async def test_admin_can_update_status(self, client, admin_user, regular_user):
        token = await _get_token(client, admin_user)

        response = await client.patch(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "SUSPENDED"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["status"] == "SUSPENDED"

    async def test_non_admin_cannot_change_role(self, client, regular_user):
        token = await _get_token(client, regular_user)

        response = await client.patch(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "ADMIN"},
        )

        assert response.status_code == 403

    async def test_non_admin_cannot_change_status(self, client, regular_user):
        token = await _get_token(client, regular_user)

        response = await client.patch(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "INACTIVE"},
        )

        assert response.status_code == 403

    async def test_user_cannot_update_other(self, client, regular_user, other_user):
        token = await _get_token(client, regular_user)

        response = await client.patch(
            f"/api/v1/users/{other_user.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Hacked"},
        )

        assert response.status_code == 403

    async def test_unknown_user_returns_404(self, client, admin_user):
        token = await _get_token(client, admin_user)

        response = await client.patch(
            f"/api/v1/users/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Ghost"},
        )

        assert response.status_code == 404


class TestDeactivateUser:
    async def test_admin_can_deactivate(self, client, admin_user, regular_user):
        token = await _get_token(client, admin_user)

        response = await client.delete(
            f"/api/v1/users/{regular_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        assert response.json()["success"] is True

    async def test_non_admin_is_forbidden(self, client, regular_user, other_user):
        token = await _get_token(client, regular_user)

        response = await client.delete(
            f"/api/v1/users/{other_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    async def test_unauthenticated_is_401(self, client, regular_user):
        response = await client.delete(f"/api/v1/users/{regular_user.id}")
        assert response.status_code == 401

    async def test_unknown_user_returns_404(self, client, admin_user):
        token = await _get_token(client, admin_user)

        response = await client.delete(
            f"/api/v1/users/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

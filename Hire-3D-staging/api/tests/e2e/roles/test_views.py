from __future__ import annotations

from uuid import uuid4

import pytest

from tests.factories import DEFAULT_PASSWORD, get_role_by_name, make_user


@pytest.fixture
async def admin_user(session):
    return await make_user(session, email="admin@example.com", role="ADMIN")


@pytest.fixture
async def operator_user(session):
    return await make_user(session, email="operator@example.com", role="OPERATOR")


@pytest.fixture
async def viewer_user(session):
    return await make_user(session, email="viewer@example.com", role="VIEWER")


async def _login(client, user) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": DEFAULT_PASSWORD},
    )
    return response.json()["data"]["accessToken"]


class TestRBACEnforcement:
    async def test_admin_can_list_roles(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.get(
            "/api/v1/roles", headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        names = [r["name"] for r in response.json()["data"]]
        assert "ADMIN" in names

    async def test_operator_cannot_list_roles(self, client, operator_user, session):
        await session.commit()
        token = await _login(client, operator_user)

        response = await client.get(
            "/api/v1/roles", headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 403

    async def test_unauthenticated_is_401(self, client):
        response = await client.get("/api/v1/roles")
        assert response.status_code == 401


class TestCreateRole:
    async def test_admin_can_create(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.post(
            "/api/v1/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "REVIEWER",
                "description": "Read-only reviewer",
                "permissions": ["clients:read"],
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert body["data"]["name"] == "REVIEWER"
        assert {p["name"] for p in body["data"]["permissions"]} == {"clients:read"}

    async def test_duplicate_name_returns_409(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.post(
            "/api/v1/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "ADMIN", "permissions": []},
        )

        assert response.status_code == 409


class TestUpdateRole:
    async def test_admin_can_update_custom_role(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        created = await client.post(
            "/api/v1/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "TEMP", "permissions": []},
        )
        role_id = created.json()["data"]["id"]

        response = await client.patch(
            f"/api/v1/roles/{role_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "TEMP_RENAMED"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["name"] == "TEMP_RENAMED"

    async def test_cannot_rename_system_role(self, client, admin_user, session):
        admin_role = await get_role_by_name(session, "ADMIN")
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.patch(
            f"/api/v1/roles/{admin_role.id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "SUPER"},
        )

        assert response.status_code == 409


class TestDeleteRole:
    async def test_admin_can_delete_custom_role(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        created = await client.post(
            "/api/v1/roles",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "TEMP", "permissions": []},
        )
        role_id = created.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/roles/{role_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200

    async def test_cannot_delete_system_role(self, client, admin_user, session):
        admin_role = await get_role_by_name(session, "ADMIN")
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.delete(
            f"/api/v1/roles/{admin_role.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 409

    async def test_cannot_delete_role_in_use(
        self, client, admin_user, viewer_user, session
    ):
        viewer_role = await get_role_by_name(session, "VIEWER")
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.delete(
            f"/api/v1/roles/{viewer_role.id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 409

    async def test_unknown_role_returns_404(self, client, admin_user, session):
        await session.commit()
        token = await _login(client, admin_user)

        response = await client.delete(
            f"/api/v1/roles/{uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 404

from __future__ import annotations

from uuid import uuid4

import pytest

from roles.stores import RolesStore
from roles.types import RoleCreate, RoleUpdate
from tests.factories import ensure_system_roles, get_role_by_name, make_user


@pytest.fixture
def store(session):
    return RolesStore(session=session)


@pytest.fixture(autouse=True)
async def _seed_system_roles(session):
    await ensure_system_roles(session)
    await session.commit()


class TestGetByName:
    async def test_returns_seeded_role(self, store):
        role = await store.get_by_name("ADMIN")
        assert role is not None and role.is_system


class TestListRoles:
    async def test_returns_all_seeded_roles(self, store):
        roles = await store.list_roles()
        names = {r.name for r in roles}
        assert {"ADMIN", "OPERATOR", "VIEWER"}.issubset(names)


class TestCreateAndUpdate:
    async def test_creates_role_with_permissions(self, store, session):
        perms = await store.get_permissions_by_names(["clients:read"])

        role = await store.create(
            RoleCreate(name="REVIEWER", description="Read-only", permissions=[]),
            perms,
        )

        assert role.id is not None
        assert role.name == "REVIEWER"
        assert {p.name for p in role.permissions} == {"clients:read"}

    async def test_updates_permissions(self, store):
        new_perms = await store.get_permissions_by_names(
            ["clients:read", "engagements:read"]
        )
        created = await store.create(
            RoleCreate(name="LIMITED", permissions=[]),
            new_perms[:1],
        )

        updated = await store.update(
            created, RoleUpdate(name="LIMITED+", permissions=None), new_perms
        )

        assert updated.name == "LIMITED+"
        assert {p.name for p in updated.permissions} == {
            "clients:read",
            "engagements:read",
        }


class TestDeleteAndHasUsers:
    async def test_has_users_detects_assignment(self, store, session):
        role = await get_role_by_name(session, "VIEWER")
        await make_user(session, email="u@example.com", role="VIEWER")
        await session.commit()

        assert await store.has_users(role.id) is True
        assert await store.has_users(uuid4()) is False

    async def test_delete_removes_role(self, store):
        perms = await store.get_permissions_by_names([])
        role = await store.create(RoleCreate(name="TEMP", permissions=[]), perms)

        await store.delete(role)

        assert await store.get_by_id(role.id) is None


class TestPermissionsForRole:
    async def test_lists_permission_names(self, store, session):
        admin = await get_role_by_name(session, "ADMIN")

        names = await store.get_permissions_for_role(admin.id)

        assert "roles:manage" in names

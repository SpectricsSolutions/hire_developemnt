from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from common.exceptions import ConflictError, NotFoundError
from roles.services import RolesService
from roles.types import RoleCreate, RoleUpdate


@pytest.fixture
def store():
    s = MagicMock()
    s.get_by_id = AsyncMock()
    s.get_by_name = AsyncMock()
    s.get_permissions_by_names = AsyncMock(return_value=[])
    s.create = AsyncMock()
    s.update = AsyncMock()
    s.delete = AsyncMock()
    s.has_users = AsyncMock(return_value=False)
    s.list_roles = AsyncMock(return_value=[])
    return s


@pytest.fixture
def service(store):
    return RolesService(store=store)


def make_role(*, name="EDITOR", is_system=False):
    role = MagicMock()
    role.id = uuid4()
    role.name = name
    role.is_system = is_system
    return role


class TestCreateRole:
    async def test_persists_when_name_is_unique(self, service, store):
        store.get_by_name.return_value = None
        created = make_role(name="EDITOR")
        store.create.return_value = created
        data = RoleCreate(name="EDITOR", description="Editors", permissions=[])

        result = await service.create_role(data)

        assert result is created
        store.create.assert_awaited_once_with(data, [])

    async def test_rejects_duplicate_name(self, service, store):
        store.get_by_name.return_value = make_role(name="EDITOR")

        with pytest.raises(ConflictError):
            await service.create_role(RoleCreate(name="EDITOR", permissions=[]))
        store.create.assert_not_awaited()


class TestUpdateRole:
    async def test_renames_role(self, service, store):
        role = make_role(name="OLD")
        store.get_by_id.return_value = role
        store.get_by_name.return_value = None
        store.update.return_value = role

        await service.update_role(role.id, RoleUpdate(name="NEW", permissions=None))

        store.update.assert_awaited_once()
        called_with = store.update.call_args.args
        assert called_with[0] is role
        assert called_with[1].name == "NEW"

    async def test_blocks_renaming_system_role(self, service, store):
        role = make_role(name="ADMIN", is_system=True)
        store.get_by_id.return_value = role

        with pytest.raises(ConflictError):
            await service.update_role(
                role.id, RoleUpdate(name="SUPER", permissions=None)
            )

    async def test_rejects_name_collision(self, service, store):
        role = make_role(name="A")
        other = make_role(name="B")
        store.get_by_id.return_value = role
        store.get_by_name.return_value = other

        with pytest.raises(ConflictError):
            await service.update_role(role.id, RoleUpdate(name="B", permissions=None))

    async def test_missing_role_raises(self, service, store):
        store.get_by_id.return_value = None

        with pytest.raises(NotFoundError):
            await service.update_role(uuid4(), RoleUpdate(permissions=None))


class TestDeleteRole:
    async def test_removes_unassigned_role(self, service, store):
        role = make_role()
        store.get_by_id.return_value = role
        store.has_users.return_value = False

        await service.delete_role(role.id)

        store.delete.assert_awaited_once_with(role)

    async def test_blocks_system_role(self, service, store):
        role = make_role(is_system=True)
        store.get_by_id.return_value = role

        with pytest.raises(ConflictError):
            await service.delete_role(role.id)
        store.delete.assert_not_awaited()

    async def test_blocks_assigned_role(self, service, store):
        role = make_role()
        store.get_by_id.return_value = role
        store.has_users.return_value = True

        with pytest.raises(ConflictError):
            await service.delete_role(role.id)
        store.delete.assert_not_awaited()

    async def test_missing_role_raises(self, service, store):
        store.get_by_id.return_value = None

        with pytest.raises(NotFoundError):
            await service.delete_role(uuid4())

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from common.exceptions import DuplicateResourceError, NotFoundError
from users.models import User
from users.services import UsersService
from users.types import UserStatus


@pytest.fixture
def store():
    return MagicMock()


@pytest.fixture
def audit_service():
    svc = MagicMock()
    svc.log_create = AsyncMock()
    svc.log_update = AsyncMock()
    svc.log_delete = AsyncMock()
    return svc


@pytest.fixture
def roles_store():
    return MagicMock()


@pytest.fixture
def service(store, roles_store, audit_service):
    return UsersService(
        store=store, roles_store=roles_store, audit_service=audit_service
    )


def make_user() -> User:
    user = MagicMock(spec=User)
    user.id = uuid4()
    user.name = "Test User"
    user.email = "user@example.com"
    user.role = None
    user.role_id = None
    user.status = UserStatus.PENDING
    return user


class TestCreateUser:
    async def test_success(self, service, store):
        store.get_by_email = AsyncMock(return_value=None)
        store.create = AsyncMock(return_value=make_user())

        user = await service.create_user(
            name="Test User",
            email="user@example.com",
            password="password123",
        )

        assert user.email == "user@example.com"
        store.create.assert_called_once()
        _, kwargs = store.create.call_args
        assert kwargs["email"] == "user@example.com"
        assert kwargs["name"] == "Test User"
        assert kwargs["hashed_password"] != "password123"

    async def test_duplicate_email_raises(self, service, store):
        store.get_by_email = AsyncMock(return_value=make_user())

        with pytest.raises(DuplicateResourceError):
            await service.create_user(
                name="Another",
                email="user@example.com",
                password="password123",
            )

        store.create.assert_not_called()


class TestGetUser:
    async def test_success(self, service, store):
        user = make_user()
        store.get_by_id = AsyncMock(return_value=user)

        result = await service.get_user(user.id)

        assert result is user

    async def test_not_found_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.get_user(uuid4())


class TestUpdateUser:
    async def test_success(self, service, store, audit_service):
        user = make_user()
        updated = make_user()
        updated.name = "Updated Name"
        store.get_by_id = AsyncMock(return_value=user)
        store.update = AsyncMock(return_value=updated)

        result = await service.update_user(
            user.id, name="Updated Name", role=None, status=None
        )

        assert result is updated
        store.update.assert_called_once_with(user, name="Updated Name")
        audit_service.log_update.assert_called_once()

    async def test_no_updates_returns_user_unchanged(
        self, service, store, audit_service
    ):
        user = make_user()
        store.get_by_id = AsyncMock(return_value=user)

        result = await service.update_user(user.id, name=None, role=None, status=None)

        assert result is user
        store.update.assert_not_called()
        audit_service.log_update.assert_not_called()

    async def test_not_found_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.update_user(uuid4(), name="X", role=None, status=None)


class TestDeactivateUser:
    async def test_success(self, service, store, audit_service):
        user = make_user()
        store.get_by_id = AsyncMock(return_value=user)
        store.deactivate = AsyncMock()

        await service.deactivate_user(user.id)

        store.deactivate.assert_called_once_with(user)
        audit_service.log_delete.assert_called_once()

    async def test_not_found_raises(self, service, store):
        store.get_by_id = AsyncMock(return_value=None)

        with pytest.raises(NotFoundError):
            await service.deactivate_user(uuid4())

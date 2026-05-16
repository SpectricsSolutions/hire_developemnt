from __future__ import annotations

import pytest

from tests.factories import make_user
from users.stores import UsersStore


@pytest.fixture
def store(session):
    return UsersStore(session=session)


class TestGetByEmail:
    async def test_found(self, store, session):
        user = await make_user(session, email="find@example.com")

        result = await store.get_by_email("find@example.com")

        assert result is not None
        assert result.id == user.id

    async def test_not_found(self, store):
        result = await store.get_by_email("missing@example.com")
        assert result is None


class TestCreate:
    async def test_creates_user(self, store):
        user = await store.create(
            name="New User",
            email="new@example.com",
            hashed_password="hashed",
        )

        assert user.id is not None
        assert user.name == "New User"
        assert user.email == "new@example.com"
        assert user.password == "hashed"

    async def test_defaults(self, store):
        user = await store.create(
            name="New User",
            email="new@example.com",
            hashed_password="hashed",
        )

        assert user.role is None
        assert user.status == "PENDING"

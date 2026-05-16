from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from common.audit_context import get_actor_id, set_actor_id
from common.exceptions import ForbiddenError, UnauthorizedError

from auth.dependencies import get_current_user, require_permission
from tests.unit.auth.helpers import make_settings, make_user


class TestGetCurrentUser:
    async def test_returns_user_and_sets_actor_id(self, monkeypatch):
        user = make_user()
        store = AsyncMock()
        store.get_user_by_id.return_value = user
        store.get_permissions_for_user.return_value = []
        settings = make_settings()
        credentials = type("Credentials", (), {"credentials": "token"})()

        monkeypatch.setattr(
            "auth.dependencies.decode_access_token",
            lambda token, cfg: {"sub": str(user.id)},
        )
        set_actor_id(None)

        result = await get_current_user(credentials, store, settings)

        assert result is user
        assert get_actor_id() == user.id

    async def test_raises_when_token_payload_has_no_sub(self, monkeypatch):
        store = AsyncMock()
        settings = make_settings()
        credentials = type("Credentials", (), {"credentials": "token"})()

        monkeypatch.setattr(
            "auth.dependencies.decode_access_token",
            lambda token, cfg: {},
        )

        with pytest.raises(UnauthorizedError):
            await get_current_user(credentials, store, settings)

    async def test_raises_when_user_is_missing(self, monkeypatch):
        store = AsyncMock()
        store.get_user_by_id.return_value = None
        settings = make_settings()
        credentials = type("Credentials", (), {"credentials": "token"})()
        user_id = uuid4()

        monkeypatch.setattr(
            "auth.dependencies.decode_access_token",
            lambda token, cfg: {"sub": str(user_id)},
        )

        with pytest.raises(UnauthorizedError):
            await get_current_user(credentials, store, settings)


class TestRequirePermission:
    async def test_allows_when_user_holds_permission(self):
        user = make_user()
        user.permissions = {"clients:create"}

        dep = require_permission("clients:create")

        assert await dep(user) is user

    async def test_rejects_when_user_lacks_permission(self):
        user = make_user()
        user.permissions = {"clients:read"}

        dep = require_permission("clients:create")

        with pytest.raises(ForbiddenError):
            await dep(user)

    async def test_requires_all_permissions(self):
        user = make_user()
        user.permissions = {"clients:read"}

        dep = require_permission("clients:read", "clients:create")

        with pytest.raises(ForbiddenError):
            await dep(user)

from __future__ import annotations

from datetime import timedelta

import pytest

from auth.stores import AuthStore
from common.datetime import get_utc_now
from tests.factories import make_user


@pytest.fixture
def store(session):
    return AuthStore(session=session)


class TestGetUserByEmail:
    async def test_found(self, store, session):
        user = await make_user(session, email="find@example.com")

        result = await store.get_user_by_email("find@example.com")

        assert result is not None
        assert result.id == user.id

    async def test_not_found(self, store):
        result = await store.get_user_by_email("missing@example.com")
        assert result is None


class TestGetUserById:
    async def test_found(self, store, session):
        user = await make_user(session, email="byid@example.com")

        result = await store.get_user_by_id(user.id)

        assert result is not None
        assert result.email == user.email

    async def test_not_found(self, store):
        from uuid import uuid4

        result = await store.get_user_by_id(uuid4())
        assert result is None


class TestCreateRefreshToken:
    async def test_creates_token(self, store, session):
        user = await make_user(session, email="token@example.com")
        expires_at = get_utc_now() + timedelta(days=7)

        token = await store.create_refresh_token(
            user_id=user.id,
            expires_at=expires_at,
            ip_address="127.0.0.1",
        )

        assert token.id is not None
        assert token.token is not None
        assert token.user_id == user.id
        assert token.ip_address == "127.0.0.1"
        assert token.revoked_at is None

    async def test_creates_token_without_ip(self, store, session):
        user = await make_user(session, email="noip@example.com")
        expires_at = get_utc_now() + timedelta(days=7)

        token = await store.create_refresh_token(
            user_id=user.id,
            expires_at=expires_at,
            ip_address=None,
        )

        assert token.ip_address is None


class TestGetRefreshToken:
    async def test_found(self, store, session):
        user = await make_user(session, email="gettoken@example.com")
        created = await store.create_refresh_token(
            user_id=user.id,
            expires_at=get_utc_now() + timedelta(days=7),
            ip_address=None,
        )

        result = await store.get_refresh_token(created.token)

        assert result is not None
        assert result.id == created.id

    async def test_not_found(self, store):
        from uuid import uuid4

        result = await store.get_refresh_token(uuid4())
        assert result is None


class TestUpdateLastUsed:
    async def test_updates_timestamp(self, store, session):
        user = await make_user(session, email="lastused@example.com")
        token = await store.create_refresh_token(
            user_id=user.id,
            expires_at=get_utc_now() + timedelta(days=7),
            ip_address=None,
        )
        assert token.last_used_at is None

        await store.update_last_used(token.id)

        updated = await store.get_refresh_token(token.token)
        assert updated.last_used_at is not None


class TestRevokeRefreshToken:
    async def test_sets_revoked_at(self, store, session):
        user = await make_user(session, email="revoke@example.com")
        token = await store.create_refresh_token(
            user_id=user.id,
            expires_at=get_utc_now() + timedelta(days=7),
            ip_address=None,
        )
        assert token.revoked_at is None

        await store.revoke_refresh_token(token.id)

        revoked = await store.get_refresh_token(token.token)
        assert revoked.revoked_at is not None


class TestRevokeAllUserTokens:
    async def test_revokes_all_active_tokens(self, store, session):
        user = await make_user(session, email="revokeall@example.com")
        expires_at = get_utc_now() + timedelta(days=7)

        t1 = await store.create_refresh_token(
            user_id=user.id, expires_at=expires_at, ip_address=None
        )
        t2 = await store.create_refresh_token(
            user_id=user.id, expires_at=expires_at, ip_address=None
        )

        await store.revoke_all_user_tokens(user.id)

        assert (await store.get_refresh_token(t1.token)).revoked_at is not None
        assert (await store.get_refresh_token(t2.token)).revoked_at is not None

    async def test_skips_already_revoked_tokens(self, store, session):
        user = await make_user(session, email="skipalready@example.com")
        token = await store.create_refresh_token(
            user_id=user.id,
            expires_at=get_utc_now() + timedelta(days=7),
            ip_address=None,
        )
        await store.revoke_refresh_token(token.id)
        first_revoked_at = (await store.get_refresh_token(token.token)).revoked_at

        await store.revoke_all_user_tokens(user.id)

        assert (
            await store.get_refresh_token(token.token)
        ).revoked_at == first_revoked_at

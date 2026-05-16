from __future__ import annotations

from typing import Annotated, Callable
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from common.audit_context import set_actor_id
from common.exceptions import ForbiddenError, UnauthorizedError
from settings import Settings, get_settings
from users.models import User

from .services import decode_access_token
from .stores import AuthStore, get_auth_store

_bearer = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    store: Annotated[AuthStore, Depends(get_auth_store)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    payload = decode_access_token(credentials.credentials, settings)

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError

    user = await store.get_user_by_id(UUID(user_id))
    if not user:
        raise UnauthorizedError

    user.permissions = set(await store.get_permissions_for_user(user.id))

    set_actor_id(user.id)
    return user


def require_permission(*required: str) -> Callable:
    async def dep(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not set(required).issubset(current_user.permissions):
            raise ForbiddenError
        return current_user

    return dep


require_authenticated = get_current_user

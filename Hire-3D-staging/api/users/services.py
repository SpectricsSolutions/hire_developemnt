from __future__ import annotations

from typing import Annotated
from uuid import UUID

from argon2 import PasswordHasher
from fastapi import Depends

from audits.services import AuditService, get_audit_service
from audits.types import ResourceRef
from common.exceptions import DuplicateResourceError, NotFoundError
from roles.stores import RolesStore, get_roles_store
from .models import User
from .stores import UsersStore, get_users_store
from .types import UserStatus

_ph = PasswordHasher()


def _user_snapshot(user: User) -> dict:
    return {
        "name": user.name,
        "email": user.email,
        "role_id": str(user.role_id) if user.role_id else None,
        "status": user.status,
    }


class UsersService:
    def __init__(
        self,
        store: UsersStore,
        roles_store: RolesStore,
        audit_service: AuditService,
    ) -> None:
        self.store = store
        self.roles_store = roles_store
        self.audit_service = audit_service

    async def _resolve_role_id(self, role_name: str | None) -> UUID | None:
        if role_name is None:
            return None
        role = await self.roles_store.get_by_name(role_name)
        if not role:
            raise NotFoundError
        return role.id

    async def create_user(
        self,
        *,
        name: str,
        email: str,
        password: str,
        role: str | None = None,
        status: UserStatus = UserStatus.PENDING,
    ) -> User:
        existing = await self.store.get_by_email(email)
        if existing:
            raise DuplicateResourceError("A user with this email already exists.")

        role_id = await self._resolve_role_id(role)
        hashed_password = _ph.hash(password)
        user = await self.store.create(
            name=name,
            email=email,
            hashed_password=hashed_password,
            role_id=role_id,
            status=status,
        )
        await self.audit_service.log_create(
            ResourceRef(type="user", id=user.id),
            after=_user_snapshot(user),
        )
        return user

    async def list_users(self) -> list[User]:
        return await self.store.list_all()

    async def get_user(self, user_id: UUID) -> User:
        user = await self.store.get_by_id(user_id)
        if not user:
            raise NotFoundError
        return user

    async def update_user(
        self,
        user_id: UUID,
        *,
        name: str | None,
        role: str | None,
        status: UserStatus | None,
    ) -> User:
        user = await self.store.get_by_id(user_id)
        if not user:
            raise NotFoundError

        updates: dict = {}
        if name is not None:
            updates["name"] = name
        if role is not None:
            updates["role_id"] = await self._resolve_role_id(role)
        if status is not None:
            updates["status"] = status

        if not updates:
            return user

        before = _user_snapshot(user)
        updated = await self.store.update(user, **updates)
        await self.audit_service.log_update(
            ResourceRef(type="user", id=user_id),
            before=before,
            after=_user_snapshot(updated),
        )
        return updated

    async def deactivate_user(self, user_id: UUID) -> None:
        user = await self.store.get_by_id(user_id)
        if not user:
            raise NotFoundError

        before = _user_snapshot(user)
        await self.store.deactivate(user)
        await self.audit_service.log_delete(
            ResourceRef(type="user", id=user_id),
            before=before,
        )


async def get_users_service(
    store: Annotated[UsersStore, Depends(get_users_store)],
    roles_store: Annotated[RolesStore, Depends(get_roles_store)],
    audit_service: Annotated[AuditService, Depends(get_audit_service)],
) -> UsersService:
    return UsersService(
        store=store, roles_store=roles_store, audit_service=audit_service
    )

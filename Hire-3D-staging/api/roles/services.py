from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from common.exceptions import ConflictError, NotFoundError

from .models import Role
from .stores import RolesStore, get_roles_store
from .types import RoleCreate, RoleUpdate


class RolesService:
    def __init__(self, store: RolesStore) -> None:
        self.store = store

    async def list_roles(self) -> list[Role]:
        return await self.store.list_roles()

    async def get_role(self, role_id: UUID) -> Role:
        role = await self.store.get_by_id(role_id)
        if not role:
            raise NotFoundError
        return role

    async def create_role(self, data: RoleCreate) -> Role:
        if await self.store.get_by_name(data.name):
            raise ConflictError(f"A role named '{data.name}' already exists.")

        permissions = await self.store.get_permissions_by_names(data.permissions)
        return await self.store.create(data, permissions)

    async def update_role(self, role_id: UUID, data: RoleUpdate) -> Role:
        role = await self.store.get_by_id(role_id)
        if not role:
            raise NotFoundError

        if role.is_system and data.name is not None and data.name != role.name:
            raise ConflictError("Cannot rename a system role.")

        if data.name is not None:
            existing = await self.store.get_by_name(data.name)
            if existing and existing.id != role_id:
                raise ConflictError(f"A role named '{data.name}' already exists.")

        permissions = None
        if data.permissions is not None:
            permissions = await self.store.get_permissions_by_names(data.permissions)

        return await self.store.update(role, data, permissions)

    async def delete_role(self, role_id: UUID) -> None:
        role = await self.store.get_by_id(role_id)
        if not role:
            raise NotFoundError

        if role.is_system:
            raise ConflictError("System roles cannot be deleted.")

        if await self.store.has_users(role_id):
            raise ConflictError("Cannot delete a role that is assigned to users.")

        await self.store.delete(role)


async def get_roles_service(
    store: Annotated[RolesStore, Depends(get_roles_store)],
) -> RolesService:
    return RolesService(store=store)

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from common.abstracts import Store
from common.database import get_db
from users.models import User

from .models import Permission, Role, RolePermission
from .types import RoleCreate, RoleUpdate


class RolesStore(Store):
    async def list_roles(self) -> list[Role]:
        result = await self.session.execute(
            select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
        )
        return list(result.scalars().all())

    async def get_by_id(self, role_id: UUID) -> Role | None:
        result = await self.session.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Role | None:
        result = await self.session.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def get_permissions_for_role(self, role_id: UUID) -> list[str]:
        result = await self.session.execute(
            select(Permission.name)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )
        return list(result.scalars().all())

    async def get_permissions_by_names(self, names: list[str]) -> list[Permission]:
        result = await self.session.execute(
            select(Permission).where(Permission.name.in_(names))
        )
        return list(result.scalars().all())

    async def list_permissions(self) -> list[Permission]:
        result = await self.session.execute(
            select(Permission).order_by(Permission.name)
        )
        return list(result.scalars().all())

    async def create(self, data: RoleCreate, permissions: list[Permission]) -> Role:
        role = Role(name=data.name, description=data.description)
        role.permissions = permissions
        self.session.add(role)
        await self.session.commit()
        await self.session.refresh(role, attribute_names=["permissions"])
        return role

    async def update(
        self,
        role: Role,
        data: RoleUpdate,
        permissions: list[Permission] | None,
    ) -> Role:
        if data.name is not None:
            role.name = data.name
        if data.description is not None:
            role.description = data.description
        if permissions is not None:
            role.permissions = permissions
        await self.session.commit()
        await self.session.refresh(role, attribute_names=["permissions"])
        return role

    async def delete(self, role: Role) -> None:
        await self.session.delete(role)
        await self.session.commit()

    async def has_users(self, role_id: UUID) -> bool:
        result = await self.session.execute(
            select(User.id).where(User.role_id == role_id).limit(1)
        )
        return result.scalar_one_or_none() is not None


async def get_roles_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> RolesStore:
    return RolesStore(session=session)

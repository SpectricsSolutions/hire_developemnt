from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from common.abstracts import Store
from common.database import get_db
from .models import User
from .types import UserStatus


class UsersStore(Store):
    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).options(selectinload(User.role)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self.session.execute(
            select(User).options(selectinload(User.role)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[User]:
        result = await self.session.execute(
            select(User)
            .options(selectinload(User.role))
            .order_by(User.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        name: str,
        email: str,
        hashed_password: str,
        role_id: UUID | None = None,
        status: UserStatus = UserStatus.PENDING,
    ) -> User:
        user = User(
            name=name,
            email=email,
            password=hashed_password,
            avatar="",
            role_id=role_id,
            status=status,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user, attribute_names=["role"])
        return user

    async def update(self, user: User, **fields) -> User:
        for key, value in fields.items():
            setattr(user, key, value)
        await self.session.commit()
        await self.session.refresh(user, attribute_names=["role"])
        return user

    async def deactivate(self, user: User) -> User:
        return await self.update(user, status=UserStatus.INACTIVE)


async def get_users_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UsersStore:
    return UsersStore(session=session)

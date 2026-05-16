from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import Depends
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from common.abstracts import Store
from common.database import get_db
from common.datetime import get_utc_now
from roles.models import Permission, RolePermission
from users.models import User

from .models import RefreshToken, UserTOTP


class AuthStore(Store):
    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).options(selectinload(User.role)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: UUID) -> User | None:
        result = await self.session.execute(
            select(User).options(selectinload(User.role)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_permissions_for_user(self, user_id: UUID) -> list[str]:
        result = await self.session.execute(
            select(Permission.name)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(User, User.role_id == RolePermission.role_id)
            .where(User.id == user_id)
        )
        return list(result.scalars().all())

    async def create_refresh_token(
        self,
        user_id: UUID,
        expires_at: datetime,
        ip_address: str | None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            expires_at=expires_at,
            ip_address=ip_address,
        )
        self.session.add(token)
        await self.session.commit()
        await self.session.refresh(token)
        return token

    async def get_refresh_token(self, token: UUID) -> RefreshToken | None:
        result = await self.session.execute(
            select(RefreshToken).where(RefreshToken.token == token)
        )
        return result.scalar_one_or_none()

    async def update_last_used(self, token_id: UUID) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.id == token_id)
            .values(last_used_at=get_utc_now())
        )
        await self.session.commit()

    async def revoke_refresh_token(self, token_id: UUID) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.id == token_id)
            .values(revoked_at=get_utc_now())
        )
        await self.session.commit()

    async def get_user_totp(self, user_id: UUID) -> UserTOTP | None:
        result = await self.session.execute(
            select(UserTOTP).where(UserTOTP.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def upsert_user_totp(self, user_id: UUID, secret: str) -> UserTOTP:
        now = get_utc_now()
        stmt = (
            insert(UserTOTP)
            .values(
                id=uuid4(),
                user_id=user_id,
                secret=secret,
                is_enabled=False,
                created_at=now,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=[UserTOTP.user_id],
                set_={"secret": secret, "is_enabled": False, "updated_at": now},
            )
            .returning(UserTOTP)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.scalar_one()

    async def revoke_all_user_tokens(self, user_id: UUID) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=get_utc_now())
        )
        await self.session.commit()

    async def enable_user_totp(self, user_id: UUID) -> None:
        await self.session.execute(
            update(UserTOTP)
            .where(UserTOTP.user_id == user_id)
            .values(is_enabled=True, updated_at=get_utc_now())
        )
        await self.session.commit()

    async def delete_user_totp(self, user_id: UUID) -> None:
        record = await self.get_user_totp(user_id)
        if record:
            await self.session.delete(record)
            await self.session.commit()


async def get_auth_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuthStore:
    return AuthStore(session=session)

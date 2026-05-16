from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.abstracts import Store
from common.database import get_db
from .models import Engagement
from .types import EngagementCreate, EngagementMeta, EngagementUpdate


class EngagementsStore(Store):
    async def get_by_id(self, engagement_id: UUID) -> Engagement | None:
        result = await self.session.execute(
            select(Engagement).where(Engagement.id == engagement_id)
        )
        return result.scalar_one_or_none()

    async def list_by_client(self, client_id: UUID) -> list[Engagement]:
        result = await self.session.execute(
            select(Engagement)
            .where(Engagement.client_id == client_id)
            .order_by(Engagement.engagement_date.desc())
        )
        return list(result.scalars().all())

    async def create(self, client_id: UUID, data: EngagementCreate) -> Engagement:
        engagement = Engagement(
            client_id=client_id,
            **data.model_dump(),
            meta=EngagementMeta(),
        )
        self.session.add(engagement)
        await self.session.commit()
        await self.session.refresh(engagement)
        return engagement

    async def update(
        self, engagement: Engagement, data: EngagementUpdate
    ) -> Engagement:
        for key, value in data.model_dump().items():
            setattr(engagement, key, value)
        await self.session.commit()
        await self.session.refresh(engagement)
        return engagement

    async def delete(self, engagement: Engagement) -> None:
        await self.session.delete(engagement)
        await self.session.commit()


async def get_engagements_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EngagementsStore:
    return EngagementsStore(session=session)

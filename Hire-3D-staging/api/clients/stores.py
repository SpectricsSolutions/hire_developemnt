from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.abstracts import Store
from common.database import get_db
from .models import Client
from .types import ClientCreate, ClientMeta, ClientUpdate


class ClientsStore(Store):
    async def get_by_id(self, client_id: UUID) -> Client | None:
        result = await self.session.execute(
            select(Client).where(Client.id == client_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Client]:
        result = await self.session.execute(
            select(Client).order_by(Client.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_by_operator(self, operator_id: UUID) -> list[Client]:
        result = await self.session.execute(
            select(Client)
            .where(Client.assigned_operator_id == operator_id)
            .order_by(Client.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, data: ClientCreate) -> Client:
        client = Client(**data.model_dump(), meta=ClientMeta())
        self.session.add(client)
        await self.session.commit()
        await self.session.refresh(client)
        return client

    async def update(self, client: Client, data: ClientUpdate) -> Client:
        for key, value in data.model_dump().items():
            setattr(client, key, value)
        await self.session.commit()
        await self.session.refresh(client)
        return client

    async def delete(self, client: Client) -> None:
        await self.session.delete(client)
        await self.session.commit()


async def get_clients_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ClientsStore:
    return ClientsStore(session=session)

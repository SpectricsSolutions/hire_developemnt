from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from sqlalchemy.exc import IntegrityError

from audits.services import AuditService, get_audit_service
from audits.types import ResourceRef
from common.exceptions import ConflictError, ForbiddenError, NotFoundError

from .models import Client
from .stores import ClientsStore, get_clients_store
from .types import ClientCreate, ClientUpdate, ClientViewer


class ClientsService:
    def __init__(self, store: ClientsStore, audit_service: AuditService) -> None:
        self.store = store
        self.audit_service = audit_service

    async def create_client(self, data: ClientCreate) -> Client:
        client = await self.store.create(data)
        await self.audit_service.log_create(
            ResourceRef(type="client", id=client.id),
            after=data.model_dump(mode="json"),
        )
        return client

    async def list_clients(self, viewer: ClientViewer) -> list[Client]:
        if viewer.can_read_all:
            return await self.store.list_all()
        return await self.store.list_by_operator(viewer.actor_id)

    async def get_client(self, client_id: UUID, viewer: ClientViewer) -> Client:
        client = await self.store.get_by_id(client_id)
        if not client:
            raise NotFoundError
        if not viewer.can_read_all and client.assigned_operator_id != viewer.actor_id:
            raise ForbiddenError
        return client

    async def update_client(self, client_id: UUID, data: ClientUpdate) -> Client:
        client = await self.store.get_by_id(client_id)
        if not client:
            raise NotFoundError

        before = ClientUpdate.model_validate(client, from_attributes=True).model_dump(
            mode="json"
        )
        updated = await self.store.update(client, data)
        await self.audit_service.log_update(
            ResourceRef(type="client", id=client_id),
            before=before,
            after=data.model_dump(mode="json"),
        )
        return updated

    async def delete_client(self, client_id: UUID) -> None:
        client = await self.store.get_by_id(client_id)
        if not client:
            raise NotFoundError

        before = ClientUpdate.model_validate(client, from_attributes=True).model_dump(
            mode="json"
        )
        try:
            await self.store.delete(client)
        except IntegrityError as exc:
            raise ConflictError(
                "Cannot delete client with existing engagements."
            ) from exc

        await self.audit_service.log_delete(
            ResourceRef(type="client", id=client_id),
            before=before,
        )


async def get_clients_service(
    store: Annotated[ClientsStore, Depends(get_clients_store)],
    audit_service: Annotated[AuditService, Depends(get_audit_service)],
) -> ClientsService:
    return ClientsService(store=store, audit_service=audit_service)

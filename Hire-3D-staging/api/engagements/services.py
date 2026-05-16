from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends

from audits.services import AuditService, get_audit_service
from audits.types import ResourceRef
from common.exceptions import NotFoundError
from .models import Engagement
from .stores import EngagementsStore, get_engagements_store
from .types import EngagementCreate, EngagementUpdate


class EngagementsService:
    def __init__(self, store: EngagementsStore, audit_service: AuditService) -> None:
        self.store = store
        self.audit_service = audit_service

    async def create_engagement(
        self, client_id: UUID, data: EngagementCreate
    ) -> Engagement:
        engagement = await self.store.create(client_id, data)
        await self.audit_service.log_create(
            ResourceRef(type="engagement", id=engagement.id),
            after=data.model_dump(mode="json"),
        )
        return engagement

    async def list_engagements(self, client_id: UUID) -> list[Engagement]:
        return await self.store.list_by_client(client_id)

    async def get_engagement(self, client_id: UUID, engagement_id: UUID) -> Engagement:
        engagement = await self.store.get_by_id(engagement_id)
        if not engagement or engagement.client_id != client_id:
            raise NotFoundError
        return engagement

    async def update_engagement(
        self, client_id: UUID, engagement_id: UUID, data: EngagementUpdate
    ) -> Engagement:
        engagement = await self.store.get_by_id(engagement_id)
        if not engagement or engagement.client_id != client_id:
            raise NotFoundError

        before = EngagementUpdate.model_validate(
            engagement, from_attributes=True
        ).model_dump(mode="json")
        updated = await self.store.update(engagement, data)
        await self.audit_service.log_update(
            ResourceRef(type="engagement", id=engagement_id),
            before=before,
            after=data.model_dump(mode="json"),
        )
        return updated

    async def delete_engagement(self, client_id: UUID, engagement_id: UUID) -> None:
        engagement = await self.store.get_by_id(engagement_id)
        if not engagement or engagement.client_id != client_id:
            raise NotFoundError

        before = EngagementUpdate.model_validate(
            engagement, from_attributes=True
        ).model_dump(mode="json")
        await self.store.delete(engagement)
        await self.audit_service.log_delete(
            ResourceRef(type="engagement", id=engagement_id),
            before=before,
        )


async def get_engagements_service(
    store: Annotated[EngagementsStore, Depends(get_engagements_store)],
    audit_service: Annotated[AuditService, Depends(get_audit_service)],
) -> EngagementsService:
    return EngagementsService(store=store, audit_service=audit_service)

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.audit_context import get_actor_id, get_ip_address
from common.database import get_db
from users.models import User

from .models import AuditLog
from .stores import AuditStore, get_audit_store
from .types import AuditAction, AuditLogQuery, AuditMeta, ResourceRef


class AuditService:
    def __init__(self, store: AuditStore, session: AsyncSession) -> None:
        self.store = store
        self.session = session

    async def list_logs(
        self, query: AuditLogQuery
    ) -> tuple[list[AuditLog], dict[UUID, str], int]:
        rows, total = await self.store.list(query)
        actor_ids = {r.actor_id for r in rows if r.actor_id is not None}
        actors: dict[UUID, str] = {}
        if actor_ids:
            result = await self.session.execute(
                select(User.id, User.name).where(User.id.in_(actor_ids))
            )
            actors = {row[0]: row[1] for row in result.all()}
        return rows, actors, total

    async def log_login(self, *, actor_id: UUID) -> None:
        await self._record(
            action=AuditAction.LOGIN,
            resource_type="session",
            actor_id=actor_id,
            event="user.login",
        )

    async def log_logout(self, *, actor_id: UUID | None = None) -> None:
        await self._record(
            action=AuditAction.LOGOUT,
            resource_type="session",
            actor_id=actor_id,
            event="user.logout",
        )

    async def log_create(self, ref: ResourceRef, *, after: dict[str, Any]) -> None:
        await self._record(
            action=AuditAction.CREATE,
            resource_type=ref.type,
            resource_id=ref.id,
            meta=AuditMeta(after=after),
        )

    async def log_update(
        self, ref: ResourceRef, *, before: dict[str, Any], after: dict[str, Any]
    ) -> None:
        await self._record(
            action=AuditAction.UPDATE,
            resource_type=ref.type,
            resource_id=ref.id,
            meta=AuditMeta(before=before, after=after),
        )

    async def log_delete(self, ref: ResourceRef, *, before: dict[str, Any]) -> None:
        await self._record(
            action=AuditAction.DELETE,
            resource_type=ref.type,
            resource_id=ref.id,
            meta=AuditMeta(before=before),
        )

    async def _record(
        self,
        *,
        action: AuditAction,
        resource_type: str,
        meta: AuditMeta | None = None,
        actor_id: UUID | None = None,
        event: str | None = None,
        resource_id: UUID | None = None,
    ) -> None:
        try:
            await self.store.create(
                actor_id=actor_id or get_actor_id(),
                action=action,
                resource_type=resource_type,
                event=event,
                resource_id=resource_id,
                ip_address=get_ip_address(),
                meta=meta or AuditMeta(),
            )
        except Exception as e:
            logger.error("Audit log write failed: {}", e)


async def get_audit_service(
    store: Annotated[AuditStore, Depends(get_audit_store)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuditService:
    return AuditService(store=store, session=session)

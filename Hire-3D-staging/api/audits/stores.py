from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.abstracts import Store
from common.database import get_db

from .models import AuditLog
from .types import AuditAction, AuditLogQuery, AuditMeta


class AuditStore(Store):
    async def create(
        self,
        *,
        actor_id: UUID | None,
        action: AuditAction,
        resource_type: str,
        event: str | None = None,
        resource_id: UUID | None = None,
        ip_address: str | None = None,
        meta: AuditMeta,
    ) -> AuditLog:
        log = AuditLog(
            actor_id=actor_id,
            action=action,
            event=event,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            meta=meta,
        )
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def list(self, query: AuditLogQuery) -> tuple[list[AuditLog], int]:
        filters = []
        if query.action is not None:
            filters.append(AuditLog.action == query.action)
        if query.resource_type is not None:
            filters.append(AuditLog.resource_type == query.resource_type)
        if query.actor_id is not None:
            filters.append(AuditLog.actor_id == query.actor_id)
        if query.before is not None:
            filters.append(AuditLog.created_at < query.before)
        if query.after is not None:
            filters.append(AuditLog.created_at >= query.after)

        count_stmt = select(func.count()).select_from(AuditLog)
        list_stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
        for f in filters:
            count_stmt = count_stmt.where(f)
            list_stmt = list_stmt.where(f)

        total = (await self.session.execute(count_stmt)).scalar_one()
        rows = (
            (
                await self.session.execute(
                    list_stmt.limit(query.limit).offset(query.offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), total


async def get_audit_store(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AuditStore:
    return AuditStore(session=session)

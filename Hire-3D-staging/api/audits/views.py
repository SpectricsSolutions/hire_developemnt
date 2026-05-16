from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from auth.dependencies import require_permission
from common.types import Response
from users.models import User

from .services import AuditService, get_audit_service
from .types import AuditLogPage, AuditLogQuery, AuditLogRead

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit Logs"])


@router.get("", operation_id="listAuditLogs")
async def list_audit_logs(
    query: Annotated[AuditLogQuery, Depends()],
    _: Annotated[User, Depends(require_permission("audit:read"))],
    service: Annotated[AuditService, Depends(get_audit_service)],
) -> Response[AuditLogPage]:
    rows, actors, total = await service.list_logs(query)
    items = [
        AuditLogRead.model_validate(r).model_copy(
            update={"actor_name": actors.get(r.actor_id) if r.actor_id else None}
        )
        for r in rows
    ]
    return Response(data=AuditLogPage(items=items, total=total))

from __future__ import annotations

import enum
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from common.types import camel_config, read_config


@enum.unique
class AuditAction(enum.StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"


class AuditMeta(BaseModel):
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None


class AuditLogQuery(BaseModel):
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    action: AuditAction | None = None
    resource_type: str | None = Field(default=None, max_length=50)
    actor_id: UUID | None = None
    before: datetime | None = None
    after: datetime | None = None


class ResourceRef(BaseModel):
    """Identifies the resource an audit entry refers to."""

    type: str
    id: UUID


class AuditLogRead(BaseModel):
    model_config = read_config

    id: UUID
    actor_id: UUID | None
    # actor_name isn't on the AuditLog row — populated via a join lookup
    # in the view layer.
    actor_name: str | None = None
    action: AuditAction
    event: str | None
    resource_type: str
    resource_id: UUID | None
    ip_address: str | None
    created_at: datetime
    meta: AuditMeta


class AuditLogPage(BaseModel):
    model_config = camel_config

    items: list[AuditLogRead]
    total: int

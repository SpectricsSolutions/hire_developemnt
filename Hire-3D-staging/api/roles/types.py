from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from common.types import camel_config, read_config

ALL_PERMISSIONS = [
    ("clients:create", "Create new clients"),
    ("clients:read", "Read client records"),
    ("clients:read_all", "Read all clients (not just assigned ones)"),
    ("clients:update", "Update client records"),
    ("clients:delete", "Delete client records"),
    ("engagements:create", "Create engagements"),
    ("engagements:read", "Read engagements"),
    ("engagements:read_fees", "Read engagement commercial fee fields"),
    ("engagements:update", "Update engagements"),
    ("engagements:delete", "Delete engagements"),
    ("users:list", "List all users"),
    ("users:read", "Read user profiles"),
    ("users:update", "Update other users"),
    ("users:delete", "Deactivate users"),
    ("roles:manage", "Manage roles and permissions"),
    ("audit:read", "View audit logs"),
    ("controls:read", "View control templates and calibration"),
    ("controls:manage", "Create, update, delete control templates and calibration"),
    ("assessments:read", "View assessments and gate status"),
    ("assessments:start", "Start a new assessment (Phase 1)"),
    ("assessments:close_phase_1", "Close Phase 1 of an assessment"),
    ("assessments:submit_phase_2", "Submit Phase 2 ratings of an assessment"),
    ("assessments:cancel", "Cancel an in-progress assessment"),
]

SYSTEM_ROLES: dict[str, list[str]] = {
    "ADMIN": [p[0] for p in ALL_PERMISSIONS],
    "OPERATOR": [
        "clients:read",
        "clients:update",
        "engagements:read",
        "engagements:update",
        "controls:read",
        "assessments:read",
        "assessments:start",
        "assessments:close_phase_1",
        "assessments:submit_phase_2",
    ],
    "VIEWER": [
        "clients:read",
        "clients:read_all",
        "engagements:read",
        "controls:read",
        "assessments:read",
    ],
}


class PermissionRead(BaseModel):
    model_config = read_config

    id: UUID
    name: str
    description: str | None


class RoleRead(BaseModel):
    model_config = read_config

    id: UUID
    name: str
    description: str | None
    is_system: bool
    permissions: list[PermissionRead]


class RoleCreate(BaseModel):
    model_config = camel_config

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    model_config = camel_config

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    permissions: list[str] | None = None

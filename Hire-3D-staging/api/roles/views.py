from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from auth.dependencies import require_permission
from common.types import NoDataResponse, Response
from users.models import User

from .services import RolesService, get_roles_service
from .types import RoleCreate, RoleRead, RoleUpdate

router = APIRouter(prefix="/api/v1/roles", tags=["Roles"])


@router.get("", operation_id="listRoles")
async def list_roles(
    _: Annotated[User, Depends(require_permission("roles:manage"))],
    service: Annotated[RolesService, Depends(get_roles_service)],
) -> Response[list[RoleRead]]:
    roles = await service.list_roles()
    return Response(data=[RoleRead.model_validate(r) for r in roles])


@router.post("", operation_id="createRole", status_code=201)
async def create_role(
    body: RoleCreate,
    _: Annotated[User, Depends(require_permission("roles:manage"))],
    service: Annotated[RolesService, Depends(get_roles_service)],
) -> Response[RoleRead]:
    role = await service.create_role(body)
    return Response(
        data=RoleRead.model_validate(role), message="Role created successfully."
    )


@router.patch("/{role_id}", operation_id="updateRole")
async def update_role(
    role_id: UUID,
    body: RoleUpdate,
    _: Annotated[User, Depends(require_permission("roles:manage"))],
    service: Annotated[RolesService, Depends(get_roles_service)],
) -> Response[RoleRead]:
    role = await service.update_role(role_id, body)
    return Response(
        data=RoleRead.model_validate(role), message="Role updated successfully."
    )


@router.delete("/{role_id}", operation_id="deleteRole")
async def delete_role(
    role_id: UUID,
    _: Annotated[User, Depends(require_permission("roles:manage"))],
    service: Annotated[RolesService, Depends(get_roles_service)],
) -> NoDataResponse:
    await service.delete_role(role_id)
    return NoDataResponse(message="Role deleted.")

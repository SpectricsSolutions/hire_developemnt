from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from auth.dependencies import get_current_user, require_permission
from common.exceptions import ForbiddenError
from common.types import NoDataResponse, Response
from users.models import User
from .services import UsersService, get_users_service
from .types import UserCreate, UserRead, UserStatus, UserUpdate

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


def _to_read(user: User) -> UserRead:
    return UserRead(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.name if user.role else None,
        status=user.status,
    )


@router.post("", operation_id="createUser", status_code=201)
async def create_user(
    body: UserCreate,
    service: Annotated[UsersService, Depends(get_users_service)],
) -> Response[UserRead]:
    user = await service.create_user(
        name=body.name,
        email=body.email,
        password=body.password,
        role=body.role,
        status=body.status or UserStatus.PENDING,
    )
    return Response(data=_to_read(user), message="Account created successfully.")


@router.get("", operation_id="listUsers")
async def list_users(
    _: Annotated[User, Depends(require_permission("users:list"))],
    service: Annotated[UsersService, Depends(get_users_service)],
) -> Response[list[UserRead]]:
    users = await service.list_users()
    return Response(data=[_to_read(u) for u in users])


@router.get("/{user_id}", operation_id="getUser")
async def get_user(
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[UsersService, Depends(get_users_service)],
) -> Response[UserRead]:
    if "users:read" not in current_user.permissions and current_user.id != user_id:
        raise ForbiddenError

    user = await service.get_user(user_id)
    return Response(data=_to_read(user))


@router.patch("/{user_id}", operation_id="updateUser")
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[UsersService, Depends(get_users_service)],
) -> Response[UserRead]:
    can_update_others = "users:update" in current_user.permissions
    is_self = current_user.id == user_id

    if not can_update_others and not is_self:
        raise ForbiddenError

    if not can_update_others and (body.role is not None or body.status is not None):
        raise ForbiddenError

    user = await service.update_user(
        user_id,
        name=body.name,
        role=body.role,
        status=body.status,
    )
    return Response(data=_to_read(user), message="User updated successfully.")


@router.delete("/{user_id}", operation_id="deactivateUser")
async def deactivate_user(
    user_id: UUID,
    _: Annotated[User, Depends(require_permission("users:delete"))],
    service: Annotated[UsersService, Depends(get_users_service)],
) -> NoDataResponse:
    await service.deactivate_user(user_id)
    return NoDataResponse(message="User deactivated.")

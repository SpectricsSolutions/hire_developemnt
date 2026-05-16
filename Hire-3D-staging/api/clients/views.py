from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from auth.dependencies import require_permission
from common.types import NoDataResponse, Response
from users.models import User

from .services import ClientsService, get_clients_service
from .types import ClientCreate, ClientRead, ClientUpdate, ClientViewer

router = APIRouter(prefix="/api/v1/clients", tags=["Clients"])


def get_viewer(
    current_user: Annotated[User, Depends(require_permission("clients:read"))],
) -> ClientViewer:
    return ClientViewer(
        actor_id=current_user.id,
        can_read_all="clients:read_all" in current_user.permissions,
    )


@router.post("", operation_id="createClient", status_code=201)
async def create_client(
    body: ClientCreate,
    _: Annotated[User, Depends(require_permission("clients:create"))],
    service: Annotated[ClientsService, Depends(get_clients_service)],
) -> Response[ClientRead]:
    client = await service.create_client(body)
    return Response(
        data=ClientRead.model_validate(client),
        message="Client created successfully.",
    )


@router.get("", operation_id="listClients")
async def list_clients(
    viewer: Annotated[ClientViewer, Depends(get_viewer)],
    service: Annotated[ClientsService, Depends(get_clients_service)],
) -> Response[list[ClientRead]]:
    clients = await service.list_clients(viewer)
    return Response(data=[ClientRead.model_validate(c) for c in clients])


@router.get("/{client_id}", operation_id="getClient")
async def get_client(
    client_id: UUID,
    viewer: Annotated[ClientViewer, Depends(get_viewer)],
    service: Annotated[ClientsService, Depends(get_clients_service)],
) -> Response[ClientRead]:
    client = await service.get_client(client_id, viewer)
    return Response(data=ClientRead.model_validate(client))


@router.put("/{client_id}", operation_id="updateClient")
async def update_client(
    client_id: UUID,
    body: ClientUpdate,
    _: Annotated[User, Depends(require_permission("clients:update"))],
    service: Annotated[ClientsService, Depends(get_clients_service)],
) -> Response[ClientRead]:
    client = await service.update_client(client_id, body)
    return Response(
        data=ClientRead.model_validate(client),
        message="Client updated successfully.",
    )


@router.delete("/{client_id}", operation_id="deleteClient")
async def delete_client(
    client_id: UUID,
    _: Annotated[User, Depends(require_permission("clients:delete"))],
    service: Annotated[ClientsService, Depends(get_clients_service)],
) -> NoDataResponse:
    await service.delete_client(client_id)
    return NoDataResponse(message="Client deleted successfully.")

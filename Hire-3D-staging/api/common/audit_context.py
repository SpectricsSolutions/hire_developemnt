from __future__ import annotations

from contextvars import ContextVar
from uuid import UUID

_actor_id: ContextVar[UUID | None] = ContextVar("actor_id", default=None)
_ip_address: ContextVar[str | None] = ContextVar("ip_address", default=None)


def set_actor_id(value: UUID | None) -> None:
    _actor_id.set(value)


def set_ip_address(value: str | None) -> None:
    _ip_address.set(value)


def get_actor_id() -> UUID | None:
    return _actor_id.get()


def get_ip_address() -> str | None:
    return _ip_address.get()

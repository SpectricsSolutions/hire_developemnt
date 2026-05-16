from __future__ import annotations

from uuid import uuid4
from datetime import datetime
from typing import Any, Generic, TypeVar, get_args, get_origin

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, declared_attr, mapped_column
from pydantic import BaseModel

from .datetime import get_utc_now
from .types import PydanticType

T = TypeVar("T", bound=BaseModel)


class IdentityMixin:
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, index=True, default=uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=get_utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=get_utc_now,
        onupdate=get_utc_now,
    )


class CreatedByMixin:
    created_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class UpdatedByMixin:
    updated_by: Mapped[UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class MetadataMixin(Generic[T]):
    _meta_type: type[BaseModel]

    def __init_subclass__(cls, **kwargs: Any) -> None:
        for base in getattr(cls, "__orig_bases__", []):
            if get_origin(base) is MetadataMixin:
                args = get_args(base)
                if args:
                    cls._meta_type = args[0]
                    break
        super().__init_subclass__(**kwargs)

    @declared_attr
    def meta(cls) -> Mapped[T]:
        meta_type = getattr(cls, "_meta_type", None)
        column_type = PydanticType(meta_type) if meta_type else JSONB
        return mapped_column(column_type, nullable=False)

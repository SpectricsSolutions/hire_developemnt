from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from common.database import Base
from common.mixins import IdentityMixin, MetadataMixin, TimestampMixin
from .types import UserMeta, UserStatus

if TYPE_CHECKING:
    from roles.models import Role


class User(IdentityMixin, TimestampMixin, MetadataMixin[UserMeta], Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    status: Mapped[UserStatus] = mapped_column(
        String(50), nullable=False, default=UserStatus.PENDING
    )

    role: Mapped[Role | None] = relationship("Role", lazy="raise")

    # Per-request permission names; populated by ``auth.dependencies.get_current_user``.
    # ClassVar so the declarative mapper ignores it.
    permissions: ClassVar[set[str]]

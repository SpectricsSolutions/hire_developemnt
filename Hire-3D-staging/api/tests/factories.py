from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from clients.models import Client
from clients.types import BusinessStage, ClientMeta, ClientStatus, UKRegion
from engagements.models import Engagement
from engagements.types import (
    AuditStatus,
    EngagementMeta,
    FeeStatus,
    Product,
)
from roles.models import Permission, Role, RolePermission
from roles.types import ALL_PERMISSIONS, SYSTEM_ROLES
from users.models import User
from users.types import UserMeta, UserStatus

_ph = PasswordHasher()

DEFAULT_PASSWORD = "password123"


async def ensure_system_roles(session: AsyncSession) -> None:
    existing_perms = {
        p.name: p for p in (await session.execute(select(Permission))).scalars().all()
    }
    for name, description in ALL_PERMISSIONS:
        if name not in existing_perms:
            perm = Permission(name=name, description=description)
            session.add(perm)
            existing_perms[name] = perm
    await session.flush()

    existing_roles = {
        r.name: r for r in (await session.execute(select(Role))).scalars().all()
    }
    for role_name, perm_names in SYSTEM_ROLES.items():
        if role_name in existing_roles:
            continue
        role = Role(name=role_name, is_system=True)
        session.add(role)
        await session.flush()
        for pname in perm_names:
            session.add(
                RolePermission(role_id=role.id, permission_id=existing_perms[pname].id)
            )
        existing_roles[role_name] = role
    await session.flush()


async def get_role_by_name(session: AsyncSession, name: str) -> Role:
    await ensure_system_roles(session)
    result = await session.execute(select(Role).where(Role.name == name))
    return result.scalar_one()


async def make_user(
    session: AsyncSession,
    *,
    email: str = "user@example.com",
    name: str = "Test User",
    password: str = DEFAULT_PASSWORD,
    role: str | None = "VIEWER",
    status: UserStatus = UserStatus.ACTIVE,
) -> User:
    role_id = None
    if role is not None:
        role_id = (await get_role_by_name(session, role)).id

    user = User(
        name=name,
        email=email,
        password=_ph.hash(password),
        avatar="https://example.com/avatar.png",
        role_id=role_id,
        status=status,
        meta=UserMeta().model_dump(mode="json"),
    )
    session.add(user)
    await session.flush()
    return user


async def make_client(
    session: AsyncSession,
    *,
    company_name: str = "Acme Ltd",
    primary_contact_email: str = "ops@acme.example.com",
    assigned_operator_id: UUID | None = None,
    status: ClientStatus = ClientStatus.ACTIVE,
) -> Client:
    if assigned_operator_id is None:
        operator = await make_user(
            session,
            email=f"operator-{uuid4().hex[:8]}@example.com",
            role="OPERATOR",
        )
        assigned_operator_id = operator.id

    client = Client(
        company_name=company_name,
        companies_house_number=None,
        primary_contact_name="Primary Contact",
        primary_contact_email=primary_contact_email,
        primary_contact_phone=None,
        sector="Technology",
        headcount_at_engagement=10,
        current_headcount=10,
        business_stage=BusinessStage.GROWTH,
        region=UKRegion.LONDON,
        assigned_operator_id=assigned_operator_id,
        internal_notes=None,
        status=status,
        meta=ClientMeta(),
    )
    session.add(client)
    await session.flush()
    return client


async def make_engagement(
    session: AsyncSession,
    *,
    client_id: UUID,
    product: Product = Product.HIRE_3D_CORE,
    engagement_date: date | None = None,
    fee_status: FeeStatus = FeeStatus.INVOICED,
    audit_status: AuditStatus = AuditStatus.SCHEDULED,
) -> Engagement:
    engagement = Engagement(
        client_id=client_id,
        product=product,
        engagement_date=engagement_date or date(2026, 1, 1),
        fee_charged=Decimal("1000.00"),
        fee_status=fee_status,
        audit_date=None,
        report_issued_date=None,
        audit_status=audit_status,
        next_review_due=None,
        meta=EngagementMeta(),
    )
    session.add(engagement)
    await session.flush()
    return engagement

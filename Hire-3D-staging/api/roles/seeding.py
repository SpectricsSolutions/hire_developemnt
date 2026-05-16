from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Permission, Role, RolePermission
from .types import ALL_PERMISSIONS, SYSTEM_ROLES


async def seed_system_roles(session: AsyncSession) -> None:
    permissions = {
        p.name: p for p in (await session.execute(select(Permission))).scalars().all()
    }
    for name, description in ALL_PERMISSIONS:
        if name not in permissions:
            perm = Permission(name=name, description=description)
            session.add(perm)
            permissions[name] = perm
    await session.flush()

    roles = {r.name: r for r in (await session.execute(select(Role))).scalars().all()}
    for role_name, perm_names in SYSTEM_ROLES.items():
        if role_name in roles:
            continue
        role = Role(name=role_name, is_system=True)
        session.add(role)
        await session.flush()
        for pname in perm_names:
            session.add(
                RolePermission(role_id=role.id, permission_id=permissions[pname].id)
            )
    await session.commit()

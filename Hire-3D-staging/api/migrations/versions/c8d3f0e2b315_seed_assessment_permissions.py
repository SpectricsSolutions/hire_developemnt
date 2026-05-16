"""seed assessment and control permissions

Revision ID: c8d3f0e2b315
Revises: b7c2e9f1a204
Create Date: 2026-05-06 17:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

from roles.models import Permission, Role, RolePermission


revision: str = "c8d3f0e2b315"
down_revision: Union[str, Sequence[str], None] = "b7c2e9f1a204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("controls:read", "View control templates and calibration"),
    ("controls:manage", "Create, update, delete control templates and calibration"),
    ("assessments:read", "View assessments and gate status"),
    ("assessments:start", "Start a new assessment (Phase 1)"),
    ("assessments:close_phase_1", "Close Phase 1 of an assessment"),
    ("assessments:submit_phase_2", "Submit Phase 2 ratings of an assessment"),
    ("assessments:cancel", "Cancel an in-progress assessment"),
]

ROLE_GRANTS: dict[str, list[str]] = {
    "ADMIN": [name for name, _ in NEW_PERMISSIONS],
    "OPERATOR": [
        "controls:read",
        "assessments:read",
        "assessments:start",
        "assessments:close_phase_1",
        "assessments:submit_phase_2",
    ],
    "VIEWER": [
        "controls:read",
        "assessments:read",
    ],
}


def upgrade() -> None:
    session = Session(bind=op.get_bind())

    existing = {
        p.name: p
        for p in session.query(Permission)
        .filter(Permission.name.in_([n for n, _ in NEW_PERMISSIONS]))
        .all()
    }
    for name, description in NEW_PERMISSIONS:
        if name not in existing:
            perm = Permission(name=name, description=description)
            session.add(perm)
            existing[name] = perm
    session.flush()

    for role_name, perm_names in ROLE_GRANTS.items():
        role = (
            session.query(Role).filter_by(name=role_name, is_system=True).one_or_none()
        )
        if role is None:
            continue
        already = {
            rp.permission_id
            for rp in session.query(RolePermission).filter_by(role_id=role.id).all()
        }
        for pname in perm_names:
            perm = existing.get(pname)
            if perm is not None and perm.id not in already:
                session.add(RolePermission(role_id=role.id, permission_id=perm.id))

    session.commit()


def downgrade() -> None:
    session = Session(bind=op.get_bind())

    perms = (
        session.query(Permission)
        .filter(Permission.name.in_([n for n, _ in NEW_PERMISSIONS]))
        .all()
    )
    perm_ids = [p.id for p in perms]
    if perm_ids:
        session.query(RolePermission).filter(
            RolePermission.permission_id.in_(perm_ids)
        ).delete(synchronize_session=False)
        session.query(Permission).filter(Permission.id.in_(perm_ids)).delete(
            synchronize_session=False
        )

    session.commit()

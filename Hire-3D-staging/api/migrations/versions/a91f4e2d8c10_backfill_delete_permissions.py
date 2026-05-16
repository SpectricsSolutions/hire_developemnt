"""backfill delete permissions

Revision ID: a91f4e2d8c10
Revises: ce4337bb24a2
Create Date: 2026-05-05 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

from roles.models import Permission, Role, RolePermission


revision: str = "a91f4e2d8c10"
down_revision: Union[str, Sequence[str], None] = "ce4337bb24a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("clients:delete", "Delete client records"),
    ("engagements:delete", "Delete engagements"),
]


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

    admin = session.query(Role).filter_by(name="ADMIN", is_system=True).one_or_none()
    if admin is not None:
        already = {
            rp.permission_id
            for rp in session.query(RolePermission).filter_by(role_id=admin.id).all()
        }
        for name, _ in NEW_PERMISSIONS:
            perm = existing[name]
            if perm.id not in already:
                session.add(RolePermission(role_id=admin.id, permission_id=perm.id))

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

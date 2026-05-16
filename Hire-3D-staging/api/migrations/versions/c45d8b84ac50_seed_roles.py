"""seed roles

Revision ID: c45d8b84ac50
Revises: 79c6348af915
Create Date: 2026-05-02 00:31:27.666879

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

from roles.models import Permission, Role, RolePermission
from roles.types import ALL_PERMISSIONS, SYSTEM_ROLES


# revision identifiers, used by Alembic.
revision: str = "c45d8b84ac50"
down_revision: Union[str, Sequence[str], None] = "79c6348af915"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    session = Session(bind=op.get_bind())

    permissions = {
        name: Permission(name=name, description=description)
        for name, description in ALL_PERMISSIONS
    }
    session.add_all(permissions.values())
    session.flush()

    for role_name, perm_names in SYSTEM_ROLES.items():
        role = Role(name=role_name, is_system=True)
        session.add(role)
        session.flush()
        session.add_all(
            RolePermission(role_id=role.id, permission_id=permissions[name].id)
            for name in perm_names
        )

    session.commit()


def downgrade() -> None:
    session = Session(bind=op.get_bind())

    system_role_ids = [
        r.id for r in session.query(Role).filter_by(is_system=True).all()
    ]
    session.query(RolePermission).filter(
        RolePermission.role_id.in_(system_role_ids)
    ).delete(synchronize_session=False)
    session.query(Role).filter(Role.id.in_(system_role_ids)).delete(
        synchronize_session=False
    )
    session.query(Permission).filter(
        Permission.name.in_([name for name, _ in ALL_PERMISSIONS])
    ).delete(synchronize_session=False)

    session.commit()

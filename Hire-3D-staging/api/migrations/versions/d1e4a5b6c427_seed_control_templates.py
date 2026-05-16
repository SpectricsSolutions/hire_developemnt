"""seed control templates and calibration anchors

Revision ID: d1e4a5b6c427
Revises: c8d3f0e2b315
Create Date: 2026-05-06 17:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

from controls.seeding.seeder import seed_controls
from controls.models import CalibrationAnchor, ControlTemplate


revision: str = "d1e4a5b6c427"
down_revision: Union[str, Sequence[str], None] = "c8d3f0e2b315"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    session = Session(bind=op.get_bind())
    seed_controls(session)


def downgrade() -> None:
    session = Session(bind=op.get_bind())
    session.query(CalibrationAnchor).delete()
    session.query(ControlTemplate).delete()
    session.commit()

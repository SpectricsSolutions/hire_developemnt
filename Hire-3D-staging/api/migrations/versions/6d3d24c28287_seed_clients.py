"""seed clients

Revision ID: 6d3d24c28287
Revises: c45d8b84ac50
Create Date: 2026-05-02 07:53:08.542194

"""

from typing import Sequence, Union

from alembic import op
from argon2 import PasswordHasher
from sqlalchemy.orm import Session

from clients.models import Client
from clients.types import BusinessStage, ClientStatus, UKRegion
from roles.models import Role
from users.models import User
from users.types import UserStatus


# revision identifiers, used by Alembic.
revision: str = "6d3d24c28287"
down_revision: Union[str, Sequence[str], None] = "c45d8b84ac50"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SEED_PASSWORD = "Password123!"

SEED_USERS = [
    ("Alice Admin", "alice.admin@hire3d.fun", "ADMIN"),
    ("Adam Admin", "adam.admin@hire3d.fun", "ADMIN"),
    ("Olivia Operator", "olivia.operator@hire3d.fun", "OPERATOR"),
    ("Riley Reader", "riley.reader@hire3d.fun", "VIEWER"),
]


def _seed_clients(operator_id):
    return [
        Client(
            company_name="Northwind Robotics Ltd",
            companies_house_number="09876543",
            primary_contact_name="Hannah Carter",
            primary_contact_email="hannah@northwind-robotics.test",
            primary_contact_phone="+442071234567",
            sector="Manufacturing",
            headcount_at_engagement=42,
            current_headcount=58,
            business_stage=BusinessStage.GROWTH,
            region=UKRegion.NORTH_WEST,
            assigned_operator_id=operator_id,
            internal_notes="Active engagement; quarterly check-ins.",
            status=ClientStatus.ACTIVE,
        ),
        Client(
            company_name="Cobalt Health Partners",
            companies_house_number="11223344",
            primary_contact_name="Jamal Idris",
            primary_contact_email="jamal@cobalthealth.test",
            primary_contact_phone="+441612223333",
            sector="Healthcare",
            headcount_at_engagement=18,
            current_headcount=22,
            business_stage=BusinessStage.EARLY,
            region=UKRegion.LONDON,
            assigned_operator_id=operator_id,
            internal_notes="Phase 1 audit running; awaiting payroll export.",
            status=ClientStatus.AUDIT_IN_PROGRESS,
        ),
        Client(
            company_name="Beacon Logistics PLC",
            companies_house_number="04567890",
            primary_contact_name="Priya Shah",
            primary_contact_email="priya@beaconlogistics.test",
            primary_contact_phone="+441179998888",
            sector="Logistics",
            headcount_at_engagement=120,
            current_headcount=135,
            business_stage=BusinessStage.ESTABLISHED,
            region=UKRegion.SOUTH_WEST,
            assigned_operator_id=operator_id,
            internal_notes="Final report delivered 2026-04-20.",
            status=ClientStatus.REPORT_ISSUED,
        ),
        Client(
            company_name="Greendrift Studios",
            companies_house_number="07654321",
            primary_contact_name="Mateo Rivera",
            primary_contact_email="mateo@greendrift.test",
            primary_contact_phone=None,
            sector="Creative",
            headcount_at_engagement=8,
            current_headcount=11,
            business_stage=BusinessStage.PRE_HIRE,
            region=UKRegion.SCOTLAND,
            assigned_operator_id=operator_id,
            internal_notes="Six-month follow-up due; chase contact.",
            status=ClientStatus.FOLLOW_UP_DUE,
        ),
        Client(
            company_name="Ironclad Forge & Co",
            companies_house_number="03219876",
            primary_contact_name="Eleanor Whitfield",
            primary_contact_email="eleanor@ironclad-forge.test",
            primary_contact_phone="+441214567890",
            sector="Engineering",
            headcount_at_engagement=65,
            current_headcount=None,
            business_stage=BusinessStage.ESTABLISHED,
            region=UKRegion.WEST_MIDLANDS,
            assigned_operator_id=None,
            internal_notes="Engagement closed; archived for reference.",
            status=ClientStatus.INACTIVE,
        ),
    ]


def upgrade() -> None:
    session = Session(bind=op.get_bind())

    roles_by_name = {r.name: r for r in session.query(Role).all()}
    hashed = PasswordHasher().hash(SEED_PASSWORD)

    users_by_email: dict[str, User] = {}
    for name, email, role_name in SEED_USERS:
        user = User(
            name=name,
            email=email,
            password=hashed,
            avatar="",
            role_id=roles_by_name[role_name].id,
            status=UserStatus.ACTIVE,
        )
        session.add(user)
        users_by_email[email] = user
    session.flush()

    operator_id = users_by_email["olivia.operator@hire3d.fun"].id
    session.add_all(_seed_clients(operator_id))

    session.commit()


def downgrade() -> None:
    session = Session(bind=op.get_bind())

    seed_company_names = [
        "Northwind Robotics Ltd",
        "Cobalt Health Partners",
        "Beacon Logistics PLC",
        "Greendrift Studios",
        "Ironclad Forge & Co",
    ]
    seed_emails = [email for _, email, _ in SEED_USERS]

    session.query(Client).filter(Client.company_name.in_(seed_company_names)).delete(
        synchronize_session=False
    )
    session.query(User).filter(User.email.in_(seed_emails)).delete(
        synchronize_session=False
    )

    session.commit()

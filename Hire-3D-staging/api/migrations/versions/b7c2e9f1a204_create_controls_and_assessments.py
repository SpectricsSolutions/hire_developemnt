"""create controls, calibration, assessments and gate-check tables

Revision ID: b7c2e9f1a204
Revises: f985f43aae34
Create Date: 2026-05-06 17:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b7c2e9f1a204"
down_revision: Union[str, Sequence[str], None] = "f985f43aae34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Engagement-level gate inputs.
    op.add_column(
        "engagements",
        sa.Column("engagement_letter_signed_at", sa.Date(), nullable=True),
    )
    op.add_column(
        "engagements",
        sa.Column("invoice_raised_at", sa.Date(), nullable=True),
    )

    op.create_table(
        "control_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("product", sa.String(length=50), nullable=False),
        sa.Column("domain", sa.String(length=1), nullable=True),
        sa.Column("code", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("what_testing", sa.Text(), nullable=False),
        sa.Column("why_matters", sa.Text(), nullable=False),
        sa.Column("primary_question", sa.Text(), nullable=False),
        sa.Column(
            "evidence_prompts", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "looking_for", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("sampling", sa.Text(), nullable=True),
        sa.Column(
            "if_partial", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "product", "code", name="uq_control_templates_product_code"
        ),
        sa.CheckConstraint(
            "(product = 'THE_CHECK' AND domain IS NULL) "
            "OR (product IN ('HIRE_3D_CORE', 'HIRE_3D_ENHANCED') AND domain IS NOT NULL) "
            "OR (product = 'HIRE_READY')",
            name="ck_control_templates_domain_matches_product",
        ),
    )
    op.create_index(
        op.f("ix_control_templates_id"), "control_templates", ["id"], unique=False
    )
    op.create_index(
        "ix_control_templates_product",
        "control_templates",
        ["product"],
        unique=False,
    )

    op.create_table(
        "calibration_anchors",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("control_template_id", sa.UUID(), nullable=False),
        sa.Column("rag_level", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity_hint", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["control_template_id"], ["control_templates.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "control_template_id",
            "rag_level",
            name="uq_calibration_anchors_template_rag",
        ),
        sa.CheckConstraint(
            "severity_hint IS NULL OR (severity_hint BETWEEN 1 AND 5)",
            name="ck_calibration_anchors_severity_range",
        ),
    )
    op.create_index(
        op.f("ix_calibration_anchors_id"), "calibration_anchors", ["id"], unique=False
    )
    op.create_index(
        "ix_calibration_anchors_template",
        "calibration_anchors",
        ["control_template_id"],
        unique=False,
    )

    op.create_table(
        "assessments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("engagement_id", sa.UUID(), nullable=False),
        sa.Column("phase_1_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("phase_1_started_by_id", sa.UUID(), nullable=True),
        sa.Column("phase_1_closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("phase_1_closed_by_id", sa.UUID(), nullable=True),
        sa.Column("phase_2_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("phase_2_submitted_by_id", sa.UUID(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["engagements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["phase_1_started_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["phase_1_closed_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["phase_2_submitted_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("engagement_id", name="uq_assessments_engagement"),
    )
    op.create_index(op.f("ix_assessments_id"), "assessments", ["id"], unique=False)

    op.create_table(
        "assessment_gate_checks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("assessment_id", sa.UUID(), nullable=True),
        sa.Column("engagement_id", sa.UUID(), nullable=False),
        sa.Column("gate", sa.String(length=50), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(
            ["assessment_id"], ["assessments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"], ["engagements.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_assessment_gate_checks_id"),
        "assessment_gate_checks",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_assessment_gate_checks_assessment",
        "assessment_gate_checks",
        ["assessment_id"],
        unique=False,
    )
    op.create_index(
        "ix_assessment_gate_checks_engagement",
        "assessment_gate_checks",
        ["engagement_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_assessment_gate_checks_engagement", table_name="assessment_gate_checks"
    )
    op.drop_index(
        "ix_assessment_gate_checks_assessment", table_name="assessment_gate_checks"
    )
    op.drop_index(
        op.f("ix_assessment_gate_checks_id"), table_name="assessment_gate_checks"
    )
    op.drop_table("assessment_gate_checks")

    op.drop_index(op.f("ix_assessments_id"), table_name="assessments")
    op.drop_table("assessments")

    op.drop_index("ix_calibration_anchors_template", table_name="calibration_anchors")
    op.drop_index(op.f("ix_calibration_anchors_id"), table_name="calibration_anchors")
    op.drop_table("calibration_anchors")

    op.drop_index("ix_control_templates_product", table_name="control_templates")
    op.drop_index(op.f("ix_control_templates_id"), table_name="control_templates")
    op.drop_table("control_templates")

    op.drop_column("engagements", "invoice_raised_at")
    op.drop_column("engagements", "engagement_letter_signed_at")

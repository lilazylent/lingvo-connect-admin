"""Allow incomplete order drafts for fast CRM intake."""

import sqlalchemy as sa
from alembic import op

revision = "0010_crm_drafts"
down_revision = "0009_crm_core"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "orders",
        "client_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )
    op.alter_column(
        "orders",
        "manager_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )


def downgrade():
    # Downgrade requires drafts to have these links filled first.
    op.alter_column(
        "orders",
        "manager_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.alter_column(
        "orders",
        "client_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )

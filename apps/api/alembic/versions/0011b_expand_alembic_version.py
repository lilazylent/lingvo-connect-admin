"""Expand Alembic version storage before long revision identifiers.

Revision ID: 0011b_version_len
Revises: 0011_order_work_tariffs
"""

from alembic import op
import sqlalchemy as sa

revision = "0011b_version_len"
down_revision = "0011_order_work_tariffs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "alembic_version",
            "version_num",
            existing_type=sa.String(length=32),
            type_=sa.String(length=128),
            existing_nullable=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "alembic_version",
            "version_num",
            existing_type=sa.String(length=128),
            type_=sa.String(length=32),
            existing_nullable=False,
        )

"""add client billing visibility to order works

Revision ID: 0022_non_billable_works
Revises: 0021_order_number_v2
"""
from alembic import op
import sqlalchemy as sa

revision = "0022_non_billable_works"
down_revision = "0021_order_number_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order_works", sa.Column("client_billable", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_index("ix_order_works_client_billable", "order_works", ["client_billable"], unique=False)
    op.alter_column("order_works", "client_billable", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_order_works_client_billable", table_name="order_works")
    op.drop_column("order_works", "client_billable")

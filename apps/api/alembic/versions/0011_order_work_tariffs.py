"""Persist the tariffs selected for each CRM order work.

Revision ID: 0011_order_work_tariffs
Revises: 0010_crm_drafts
"""

import sqlalchemy as sa
from alembic import op

revision = "0011_order_work_tariffs"
down_revision = "0010_crm_drafts"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("order_works", sa.Column("tariff_ids", sa.Text(), nullable=False, server_default=""))

def downgrade():
    op.drop_column("order_works", "tariff_ids")

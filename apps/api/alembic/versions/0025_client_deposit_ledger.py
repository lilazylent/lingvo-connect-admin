"""client deposit ledger

Revision ID: 0025_client_deposit_ledger
Revises: 0024_service_work_fields
"""
from alembic import op
import sqlalchemy as sa

revision = "0025_client_deposit_ledger"
down_revision = "0024_service_work_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("companies", sa.Column("deposit_balance", sa.Numeric(14, 2), nullable=False, server_default="0"))
    op.create_table(
        "client_deposit_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("actor_user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 2), nullable=False),
        sa.Column("note", sa.String(500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("order_id", name="uq_client_deposit_transactions_order_id"),
    )
    op.create_index("ix_client_deposit_transactions_company_id", "client_deposit_transactions", ["company_id"])
    op.create_index("ix_client_deposit_transactions_kind", "client_deposit_transactions", ["kind"])
    op.create_index("ix_client_deposit_transactions_created_at", "client_deposit_transactions", ["created_at"])


def downgrade():
    op.drop_index("ix_client_deposit_transactions_created_at", table_name="client_deposit_transactions")
    op.drop_index("ix_client_deposit_transactions_kind", table_name="client_deposit_transactions")
    op.drop_index("ix_client_deposit_transactions_company_id", table_name="client_deposit_transactions")
    op.drop_table("client_deposit_transactions")
    op.drop_column("companies", "deposit_balance")

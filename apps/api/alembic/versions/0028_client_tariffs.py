"""Client-specific tariffs and per-document written translation.

Revision ID: 0028_client_tariffs
Revises: 0027_owner_feedback_batch_01
"""

from alembic import op
import sqlalchemy as sa

revision = "0028_client_tariffs"
down_revision = "0027_owner_feedback_batch_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("pricing_mode", sa.String(length=20), nullable=False, server_default="STANDARD"))
    op.add_column("companies", sa.Column("client_discount_percent", sa.Numeric(8, 4), nullable=False, server_default="0"))
    op.create_table(
        "client_tariffs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("company_id", sa.String(length=36), nullable=False),
        sa.Column("service_code", sa.String(length=64), nullable=False),
        sa.Column("variant", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("source_language", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("target_language", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("quantity_from", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_tariffs_company_id", "client_tariffs", ["company_id"])
    op.create_index("ix_client_tariffs_service_code", "client_tariffs", ["service_code"])
    op.create_index("ix_client_tariffs_active", "client_tariffs", ["active"])


def downgrade() -> None:
    op.drop_index("ix_client_tariffs_active", table_name="client_tariffs")
    op.drop_index("ix_client_tariffs_service_code", table_name="client_tariffs")
    op.drop_index("ix_client_tariffs_company_id", table_name="client_tariffs")
    op.drop_table("client_tariffs")
    op.drop_column("companies", "client_discount_percent")
    op.drop_column("companies", "pricing_mode")

"""Private files on accepted orders."""

import sqlalchemy as sa

from alembic import op

revision = "0008_order_files"
down_revision = "0007_import_batches"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "order_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "order_id",
            sa.String(36),
            sa.ForeignKey("orders.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(500), nullable=False, unique=True),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column(
            "uploaded_by",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_order_files_order_id", "order_files", ["order_id"])


def downgrade():
    op.drop_table("order_files")

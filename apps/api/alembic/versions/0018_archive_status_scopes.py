"""Archive-aware order status scopes for the Phase 09 release candidate.

Revision ID: 0018_archive_status_scopes
Revises: 0017_phase6_catalogs
"""

from alembic import op
import sqlalchemy as sa

revision = "0018_archive_status_scopes"
down_revision = "0017_phase6_catalogs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "order_status_options",
        sa.Column("board", sa.String(length=20), nullable=False, server_default="MAIN"),
    )
    op.create_index("ix_order_status_options_board", "order_status_options", ["board"])

    # CANCELLED becomes the default archive lane. Existing cancelled orders are
    # moved into the archive so they no longer disappear between Table/Kanban.
    op.execute("UPDATE order_status_options SET board = 'ARCHIVE' WHERE code = 'CANCELLED'")
    op.execute("UPDATE orders SET archived = true WHERE status = 'CANCELLED'")


def downgrade():
    op.drop_index("ix_order_status_options_board", table_name="order_status_options")
    op.drop_column("order_status_options", "board")

"""Order-level deadline time mode (DOCX v3, step «Общее и Клиент»).

Revision ID: 0029_order_deadline_mode
Revises: 0028_client_tariffs

Existing orders keep their computed deadline: ``deadline_manual`` defaults to false (the
deadline is still derived from the works) and ``deadline_time_mode`` stays '' = not specified.
"""

from alembic import op
import sqlalchemy as sa

revision = "0029_order_deadline_mode"
down_revision = "0028_client_tariffs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("deadline_manual", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("orders", sa.Column("deadline_time_mode", sa.String(length=16), nullable=False, server_default=""))
    op.add_column("orders", sa.Column("deadline_time", sa.String(length=5), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("orders", "deadline_time")
    op.drop_column("orders", "deadline_time_mode")
    op.drop_column("orders", "deadline_manual")

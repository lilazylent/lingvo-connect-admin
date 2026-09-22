"""Phase 10.1 executor availability calendar foundation.

Revision ID: 0019_executor_availability
Revises: 0018_archive_status_scopes
"""

from alembic import op
import sqlalchemy as sa

revision = "0019_executor_availability"
down_revision = "0018_archive_status_scopes"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "executor_availability",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("executor_id", sa.String(length=36), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.ForeignKeyConstraint(["executor_id"], ["executors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("end_date >= start_date", name="ck_executor_availability_date_order"),
        sa.CheckConstraint(
            "state IN ('FREE', 'BUSY', 'UNAVAILABLE', 'VACATION')",
            name="ck_executor_availability_state",
        ),
    )
    op.create_index("ix_executor_availability_executor_id", "executor_availability", ["executor_id"])
    op.create_index("ix_executor_availability_state", "executor_availability", ["state"])
    op.create_index("ix_executor_availability_start_date", "executor_availability", ["start_date"])
    op.create_index("ix_executor_availability_end_date", "executor_availability", ["end_date"])


def downgrade():
    op.drop_index("ix_executor_availability_end_date", table_name="executor_availability")
    op.drop_index("ix_executor_availability_start_date", table_name="executor_availability")
    op.drop_index("ix_executor_availability_state", table_name="executor_availability")
    op.drop_index("ix_executor_availability_executor_id", table_name="executor_availability")
    op.drop_table("executor_availability")

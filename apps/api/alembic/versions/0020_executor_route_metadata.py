"""add executor assignment route stage metadata

Revision ID: 0020_executor_route_metadata
Revises: 0019_executor_availability
"""

from alembic import op
import sqlalchemy as sa

revision = "0020_executor_route_metadata"
down_revision = "0019_executor_availability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("executor_assignments", sa.Column("route_stage_index", sa.Integer(), nullable=True))
    op.add_column("executor_assignments", sa.Column("route_source_language", sa.String(length=80), nullable=False, server_default=""))
    op.add_column("executor_assignments", sa.Column("route_target_language", sa.String(length=80), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("executor_assignments", "route_target_language")
    op.drop_column("executor_assignments", "route_source_language")
    op.drop_column("executor_assignments", "route_stage_index")

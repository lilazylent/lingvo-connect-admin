"""Relate incoming requests to client directory without replacing original contact text."""

import sqlalchemy as sa

from alembic import op

revision = "0006_application_clients"
down_revision = "0005_operations"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "application_clients",
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "client_id",
            sa.String(36),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
    )
    op.create_index("ix_application_clients_client_id", "application_clients", ["client_id"])


def downgrade():
    op.drop_table("application_clients")

"""Company directory and representatives; additive, no existing data rewritten."""

import sqlalchemy as sa

from alembic import op

revision = "0003_clients"
down_revision = "0002_applications"
branch_labels = None
depends_on = None


def metadata_columns():
    return [
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.create_table(
        "companies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("tax_id", sa.String(12), unique=True),
        sa.Column("notes", sa.Text(), nullable=False),
        *metadata_columns(),
    )
    op.create_index("ix_companies_name", "companies", ["name"])
    op.create_index("ix_companies_archived", "companies", ["archived"])
    op.create_table(
        "representatives",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "company_id",
            sa.String(36),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("position", sa.String(160), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(40), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        *metadata_columns(),
    )
    op.create_index("ix_representatives_company_id", "representatives", ["company_id"])
    op.create_index("ix_representatives_archived", "representatives", ["archived"])
    op.create_table(
        "client_activity",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "company_id",
            sa.String(36),
            sa.ForeignKey("companies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "representative_id",
            sa.String(36),
            sa.ForeignKey("representatives.id", ondelete="RESTRICT"),
        ),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_client_activity_company_id", "client_activity", ["company_id"])


def downgrade():
    op.drop_table("client_activity")
    op.drop_table("representatives")
    op.drop_table("companies")

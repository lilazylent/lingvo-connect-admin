"""Add one-time user invitation registration flow.

Revision ID: 0026_user_invitations
Revises: 0025_client_deposit_ledger
"""

from alembic import op
import sqlalchemy as sa

revision = "0026_user_invitations"
down_revision = "0025_client_deposit_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_invitations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("accepted_user_id", sa.String(length=36), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["accepted_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_user_invitations_email", "user_invitations", ["email"], unique=False)
    op.create_index("ix_user_invitations_role", "user_invitations", ["role"], unique=False)
    op.create_index("ix_user_invitations_token_hash", "user_invitations", ["token_hash"], unique=True)
    op.create_index("ix_user_invitations_created_by_user_id", "user_invitations", ["created_by_user_id"], unique=False)
    op.create_index("ix_user_invitations_accepted_user_id", "user_invitations", ["accepted_user_id"], unique=False)
    op.create_index("ix_user_invitations_expires_at", "user_invitations", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_invitations_expires_at", table_name="user_invitations")
    op.drop_index("ix_user_invitations_accepted_user_id", table_name="user_invitations")
    op.drop_index("ix_user_invitations_created_by_user_id", table_name="user_invitations")
    op.drop_index("ix_user_invitations_token_hash", table_name="user_invitations")
    op.drop_index("ix_user_invitations_role", table_name="user_invitations")
    op.drop_index("ix_user_invitations_email", table_name="user_invitations")
    op.drop_table("user_invitations")

"""Create authentication and security audit foundation.

Revision ID: 0001_auth
Revises:
"""

import sqlalchemy as sa

from alembic import op

revision = "0001_auth"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("must_change_password", sa.Boolean(), nullable=False),
        sa.Column("two_factor_enabled", sa.Boolean(), nullable=False),
        sa.Column("two_factor_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_hash", sa.String(64), nullable=False),
        sa.Column("auth_stage", sa.String(32), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_token_hash", "user_sessions", ["token_hash"])
    op.create_index("ix_user_sessions_auth_stage", "user_sessions", ["auth_stage"])

    op.create_table(
        "recovery_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("code_hash"),
    )
    op.create_index("ix_recovery_codes_user_id", "recovery_codes", ["user_id"])

    op.create_table(
        "security_audit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_user_id", sa.String(36), nullable=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_security_audit_events_actor_user_id", "security_audit_events", ["actor_user_id"]
    )
    op.create_index(
        "ix_security_audit_events_target_user_id", "security_audit_events", ["target_user_id"]
    )
    op.create_index("ix_security_audit_events_action", "security_audit_events", ["action"])
    op.create_index(
        "ix_security_audit_action_created", "security_audit_events", ["action", "created_at"]
    )


def downgrade() -> None:
    op.drop_table("security_audit_events")
    op.drop_table("recovery_codes")
    op.drop_table("user_sessions")
    op.drop_table("users")

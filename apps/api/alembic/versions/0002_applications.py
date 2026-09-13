"""Create the Phase 2 applications workspace.

Revision ID: 0002_applications
Revises: 0001_auth
"""

import sqlalchemy as sa

from alembic import op

revision = "0002_applications"
down_revision = "0001_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE application_number_seq START WITH 1 INCREMENT BY 1")
    op.create_table(
        "applications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "sequence_number",
            sa.BigInteger(),
            server_default=sa.text("nextval('application_number_seq')"),
            nullable=False,
        ),
        sa.Column("number", sa.String(24), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("contact_method", sa.String(24), nullable=False),
        sa.Column("contact", sa.String(320), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("company", sa.String(200), nullable=True),
        sa.Column("requested_service", sa.String(64), nullable=False),
        sa.Column("source_language", sa.String(80), nullable=True),
        sa.Column("target_language", sa.String(80), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("desired_date", sa.Date(), nullable=True),
        sa.Column("status_code", sa.String(32), nullable=False),
        sa.Column(
            "responsible_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("internal_summary", sa.Text(), nullable=True),
        sa.Column("source", sa.String(32), nullable=False),
        sa.Column("source_identifier", sa.String(80), nullable=True),
        sa.Column("consent_accepted", sa.Boolean(), nullable=False),
        sa.Column("consent_version", sa.String(64), nullable=True),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("utm_source", sa.String(100), nullable=True),
        sa.Column("utm_medium", sa.String(100), nullable=True),
        sa.Column("utm_campaign", sa.String(150), nullable=True),
        sa.Column("utm_content", sa.String(150), nullable=True),
        sa.Column("utm_term", sa.String(150), nullable=True),
        sa.Column("public_request_id", sa.String(80), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("fingerprint", sa.String(64), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.UniqueConstraint("sequence_number"),
        sa.UniqueConstraint("number"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_applications_number", "applications", ["number"])
    op.create_index("ix_applications_name", "applications", ["name"])
    op.create_index("ix_applications_contact", "applications", ["contact"])
    op.create_index("ix_applications_email", "applications", ["email"])
    op.create_index("ix_applications_phone", "applications", ["phone"])
    op.create_index("ix_applications_company", "applications", ["company"])
    op.create_index("ix_applications_requested_service", "applications", ["requested_service"])
    op.create_index("ix_applications_status_code", "applications", ["status_code"])
    op.create_index("ix_applications_responsible_user_id", "applications", ["responsible_user_id"])
    op.create_index("ix_applications_source", "applications", ["source"])
    op.create_index("ix_applications_source_identifier", "applications", ["source_identifier"])
    op.create_index(
        "ix_applications_status_submitted", "applications", ["status_code", "submitted_at"]
    )
    op.create_index(
        "ix_applications_responsible_status",
        "applications",
        ["responsible_user_id", "status_code"],
    )

    op.create_table(
        "application_comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_application_comments_application_id", "application_comments", ["application_id"]
    )
    op.create_index(
        "ix_application_comments_author_user_id", "application_comments", ["author_user_id"]
    )

    op.create_table(
        "application_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
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
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_application_files_application_id", "application_files", ["application_id"])

    op.create_table(
        "application_activity",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("event_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_application_activity_application_id", "application_activity", ["application_id"]
    )
    op.create_index(
        "ix_application_activity_actor_user_id", "application_activity", ["actor_user_id"]
    )
    op.create_index("ix_application_activity_event_type", "application_activity", ["event_type"])
    op.create_index(
        "ix_application_activity_application_created",
        "application_activity",
        ["application_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("application_activity")
    op.drop_table("application_files")
    op.drop_table("application_comments")
    op.drop_table("applications")
    op.execute("DROP SEQUENCE application_number_seq")

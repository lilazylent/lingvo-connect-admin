"""Allow files submitted by public website visitors.

Revision ID: 0003_public_application_files
Revises: 0002_applications
"""


from alembic import op

revision = "0003_public_application_files"
down_revision = "0002_applications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "application_files_uploaded_by_fkey",
        "application_files",
        type_="foreignkey",
    )
    op.alter_column("application_files", "uploaded_by", nullable=True)
    op.create_foreign_key(
        "application_files_uploaded_by_fkey",
        "application_files",
        "users",
        ["uploaded_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "application_files_uploaded_by_fkey",
        "application_files",
        type_="foreignkey",
    )
    op.alter_column("application_files", "uploaded_by", nullable=False)
    op.create_foreign_key(
        "application_files_uploaded_by_fkey",
        "application_files",
        "users",
        ["uploaded_by"],
        ["id"],
        ondelete="RESTRICT",
    )

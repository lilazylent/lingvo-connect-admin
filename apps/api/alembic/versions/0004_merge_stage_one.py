"""Join existing client draft and public attachment branches without rewriting either."""

revision = "0004_merge_stage_one"
down_revision = ("0003_clients", "0003_public_application_files")
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass

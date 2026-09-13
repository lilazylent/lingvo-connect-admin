"""Polish customer-facing service names in the CRM catalog.

Revision ID: 0013_polish_service_names
Revises: 0012_exact_2026_translation_tariffs
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_polish_service_names"
down_revision = "0012_exact_2026_translation_tariffs"
branch_labels = None
depends_on = None

RENAMES = {
    "company_certification": ("Заверение наше", "Наше заверение"),
    "notarial_certification": ("Заверение нотариальное", "Нотариальное заверение"),
}


def upgrade():
    bind = op.get_bind()
    services = sa.table("service_types", sa.column("code", sa.String), sa.column("name", sa.String))
    for code, (_, polished) in RENAMES.items():
        bind.execute(services.update().where(services.c.code == code).values(name=polished))


def downgrade():
    bind = op.get_bind()
    services = sa.table("service_types", sa.column("code", sa.String), sa.column("name", sa.String))
    for code, (legacy, _) in RENAMES.items():
        bind.execute(services.update().where(services.c.code == code).values(name=legacy))

"""Activate «Скан» (owner decision 2026-11-01: priced per actual page).

Revision ID: 0031_activate_scan
Revises: 0030_work_v3_fields

0024 retired the service as missing from the matrix; the owner wants it in the work list
again. Only the existing row is switched on — nothing is created, tariffs are untouched.
"""

from datetime import UTC, datetime

from alembic import op
import sqlalchemy as sa

revision = "0031_activate_scan"
down_revision = "0030_work_v3_fields"
branch_labels = None
depends_on = None

services = sa.table(
    "service_types",
    sa.column("code", sa.String),
    sa.column("active", sa.Boolean),
    sa.column("updated_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    op.execute(services.update().where(services.c.code == "scan", services.c.active.is_(False)).values(active=True, updated_at=datetime.now(UTC)))


def downgrade() -> None:
    op.execute(services.update().where(services.c.code == "scan").values(active=False, updated_at=datetime.now(UTC)))

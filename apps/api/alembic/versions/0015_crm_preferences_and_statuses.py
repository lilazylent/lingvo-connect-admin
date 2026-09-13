"""CRM appearance preference and configurable order status labels.

Revision ID: 0015_crm_preferences_and_statuses
Revises: 0014_merge_tariff_branches
"""

from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "0015_crm_preferences_and_statuses"
down_revision = "0014_merge_tariff_branches"
branch_labels = None
depends_on = None

STATUSES = [
    ("NEW", "Новый", "blue", 10),
    ("ESTIMATING", "В расчёте", "violet", 20),
    ("APPROVED", "Согласован", "cyan", 30),
    ("IN_PROGRESS", "В работе", "amber", 40),
    ("REVIEW", "На проверке", "violet", 50),
    ("READY", "Готов", "green", 60),
    ("DELIVERED", "Выдан", "cyan", 70),
    ("COMPLETED", "Завершён", "green", 80),
    ("CANCELLED", "Отменён", "rose", 90),
]


def upgrade():
    op.add_column("users", sa.Column("interface_theme", sa.String(length=16), nullable=False, server_default="system"))
    op.create_table(
        "order_status_options",
        sa.Column("code", sa.String(length=32), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False, server_default="slate"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_order_status_options_active", "order_status_options", ["active"])
    table = sa.table(
        "order_status_options",
        sa.column("code", sa.String), sa.column("name", sa.String), sa.column("color", sa.String),
        sa.column("active", sa.Boolean), sa.column("sort_order", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)), sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(UTC)
    op.bulk_insert(table, [dict(code=c, name=n, color=color, active=True, sort_order=order, created_at=now, updated_at=now) for c, n, color, order in STATUSES])


def downgrade():
    op.drop_index("ix_order_status_options_active", table_name="order_status_options")
    op.drop_table("order_status_options")
    op.drop_column("users", "interface_theme")

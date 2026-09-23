"""Owner feedback batch 01: roles, urgency defaults and order numbering.

Revision ID: 0027_owner_feedback_batch_01
Revises: 0026_user_invitations
"""

from alembic import op
import sqlalchemy as sa
from datetime import UTC, datetime

revision = "0027_owner_feedback_batch_01"
down_revision = "0026_user_invitations"
branch_labels = None
depends_on = None

MANAGER_PERMISSIONS = [
    "OVERVIEW_VIEW",
    "APPLICATIONS_VIEW", "APPLICATIONS_EDIT",
    "CLIENTS_VIEW", "CLIENTS_EDIT",
    "ORDERS_VIEW", "ORDERS_EDIT",
    "EXECUTORS_VIEW", "EXECUTORS_EDIT",
    "FILES_VIEW", "FILES_EDIT",
]

ALL_PERMISSIONS = MANAGER_PERMISSIONS + ["USERS_MANAGE", "SETTINGS_MANAGE", "IMPORTS_MANAGE"]


def upgrade() -> None:
    op.alter_column("users", "role", existing_type=sa.String(length=20), type_=sa.String(length=64), existing_nullable=False)
    op.alter_column("user_invitations", "role", existing_type=sa.String(length=20), type_=sa.String(length=64), existing_nullable=False)

    op.create_table(
        "role_definitions",
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("code"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_role_definitions_is_active", "role_definitions", ["is_active"], unique=False)

    bind = op.get_bind()
    roles = sa.table(
        "role_definitions",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("permissions", sa.JSON),
        sa.column("is_system", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(UTC)
    op.bulk_insert(roles, [
        {
            "code": "ADMIN",
            "name": "Администратор",
            "permissions": ALL_PERMISSIONS,
            "is_system": True,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "code": "MANAGER",
            "name": "Менеджер",
            "permissions": MANAGER_PERMISSIONS,
            "is_system": True,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ])

    # The old x1.5 values were defaults, not confirmed business rules.
    bind.execute(sa.text("UPDATE order_works SET urgency_multiplier = 1 WHERE urgent = false AND urgency_multiplier = 1.5"))
    bind.execute(sa.text("UPDATE tariffs SET urgency_multiplier = 1 WHERE urgency_multiplier = 1.5"))

    # Normalize the owner-facing number from YY-0-NNNN to YY-NNNN.
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text("""
            UPDATE orders
            SET number = regexp_replace(number, '^([0-9]{2})-0-([0-9]{4})$', '\\1-\\2')
            WHERE number ~ '^[0-9]{2}-0-[0-9]{4}$'
        """))
    else:
        rows = bind.execute(sa.text("SELECT id, number FROM orders")).fetchall()
        for row in rows:
            number = row.number
            parts = number.split("-")
            if len(parts) == 3 and len(parts[0]) == 2 and parts[1] == "0" and len(parts[2]) == 4:
                bind.execute(sa.text("UPDATE orders SET number=:number WHERE id=:id"), {"number": f"{parts[0]}-{parts[2]}", "id": row.id})


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_index("ix_role_definitions_is_active", table_name="role_definitions")
    op.drop_table("role_definitions")
    op.alter_column("user_invitations", "role", existing_type=sa.String(length=64), type_=sa.String(length=20), existing_nullable=False)
    op.alter_column("users", "role", existing_type=sa.String(length=64), type_=sa.String(length=20), existing_nullable=False)

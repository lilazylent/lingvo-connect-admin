"""Phase 06 canonical languages and executor rate foundation.

Revision ID: 0017_phase6_catalogs
Revises: 0016_work_pricing_assignments
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "0017_phase6_catalogs"
down_revision = "0016_work_pricing_assignments"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "language_catalog",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", name="uq_language_catalog_name"),
    )
    op.create_index("ix_language_catalog_name", "language_catalog", ["name"])
    op.create_index("ix_language_catalog_active", "language_catalog", ["active"])

    op.add_column(
        "executor_directions",
        sa.Column("default_rate", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "executor_directions",
        sa.Column(
            "rate_unit",
            sa.String(32),
            nullable=False,
            server_default="CONDITIONAL_PAGE",
        ),
    )

    bind = op.get_bind()
    languages: set[str] = {"Русский"}
    sources = [
        ("tariffs", "source_language", "target_language"),
        ("order_works", "source_language", "target_language"),
        ("executor_directions", "source_language", "target_language"),
    ]
    for table, source_col, target_col in sources:
        rows = bind.execute(
            sa.text(
                f"SELECT {source_col} AS source_language, {target_col} AS target_language FROM {table}"
            )
        ).mappings()
        for row in rows:
            for value in (row["source_language"], row["target_language"]):
                if value and str(value).strip():
                    languages.add(str(value).strip())

    now = datetime.now(timezone.utc)
    language_table = sa.table(
        "language_catalog",
        sa.column("id", sa.String),
        sa.column("name", sa.String),
        sa.column("active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    for index, name in enumerate(sorted(languages, key=str.casefold), start=1):
        bind.execute(
            language_table.insert().values(
                id=str(uuid.uuid4()),
                name=name,
                active=True,
                sort_order=index * 10,
                created_at=now,
                updated_at=now,
            )
        )


def downgrade():
    op.drop_column("executor_directions", "rate_unit")
    op.drop_column("executor_directions", "default_rate")
    op.drop_index("ix_language_catalog_active", table_name="language_catalog")
    op.drop_index("ix_language_catalog_name", table_name="language_catalog")
    op.drop_table("language_catalog")

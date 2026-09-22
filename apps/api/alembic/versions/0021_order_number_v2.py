"""renumber existing orders to YY-0-NNNN and rebuild yearly counters

Revision ID: 0021_order_number_v2
Revises: 0020_executor_route_metadata
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime

from alembic import op
import sqlalchemy as sa

revision = "0021_order_number_v2"
down_revision = "0020_executor_route_metadata"
branch_labels = None
depends_on = None


def _execution_year(deadline: date | None, created_at: datetime) -> int:
    return deadline.year if deadline is not None else created_at.year


def upgrade() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    orders = sa.Table("orders", metadata, autoload_with=bind)
    counters = sa.Table("order_counters", metadata, autoload_with=bind)

    rows = list(
        bind.execute(
            sa.select(
                orders.c.id,
                orders.c.deadline,
                orders.c.created_at,
            ).order_by(orders.c.created_at.asc(), orders.c.id.asc())
        ).mappings()
    )

    # Move every existing public number out of the final namespace first so the
    # unique constraint cannot collide while rows are deterministically renumbered.
    for ordinal, row in enumerate(rows, start=1):
        # orders.number is VARCHAR(32). Do not use the UUID in the temporary
        # value: `MIG-<uuid>` is 40 characters and breaks PostgreSQL before
        # the real renumbering can begin. A deterministic ordinal is unique
        # within this migration, safely below the column limit and is fully
        # replaced by the final YY-0-NNNN number in the same transaction.
        temporary_number = f"MIG-{ordinal:08d}"
        bind.execute(
            orders.update()
            .where(orders.c.id == row["id"])
            .values(number=temporary_number)
        )

    grouped: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[_execution_year(row["deadline"], row["created_at"])].append(row)

    yearly_counts: dict[int, int] = {}
    for year in sorted(grouped):
        year_rows = sorted(grouped[year], key=lambda item: (item["created_at"], item["id"]))
        for sequence, row in enumerate(year_rows, start=1):
            number = f"{year % 100:02d}-0-{sequence:04d}"
            bind.execute(
                orders.update()
                .where(orders.c.id == row["id"])
                .values(number=number)
            )
        yearly_counts[year] = len(year_rows)

    # order_counters is dedicated to public order numbering. Rebuild it from the
    # actual migrated rows so preview/create agree immediately after upgrade.
    bind.execute(counters.delete())
    for year, value in sorted(yearly_counts.items()):
        bind.execute(counters.insert().values(id=year, value=value))


def downgrade() -> None:
    # Public order numbers are immutable business identifiers after this migration.
    # The previous LC-O/YY-NNNN values cannot be reconstructed safely once new
    # orders have been created, so downgrade intentionally preserves the v2 data.
    pass

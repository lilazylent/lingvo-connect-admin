"""Per-work pricing controls and executor assignment splits.

Revision ID: 0016_work_pricing_assignments
Revises: 0015_crm_preferences_and_statuses
"""

from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0016_work_pricing_assignments"
down_revision = "0015_crm_preferences_and_statuses"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "order_works",
        sa.Column("urgency_multiplier", sa.Numeric(8, 4), nullable=False, server_default="1.5000"),
    )
    op.add_column(
        "order_works",
        sa.Column("discount_percent", sa.Numeric(8, 4), nullable=False, server_default="0"),
    )
    op.add_column(
        "order_works",
        sa.Column("discount_overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "executor_assignments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("work_id", sa.String(length=36), sa.ForeignKey("order_works.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("executor_id", sa.String(length=36), sa.ForeignKey("executors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("character_count", sa.Integer(), nullable=True),
        sa.Column("page_count", sa.Numeric(10, 2), nullable=True),
        sa.Column("billing_unit", sa.String(length=32), nullable=False, server_default="CONDITIONAL_PAGE"),
        sa.Column("rate", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("auto_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("cost_overridden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("amount_paid", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("deadline_time", sa.String(length=5), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="NEW"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_executor_assignments_work_id", "executor_assignments", ["work_id"])
    op.create_index("ix_executor_assignments_executor_id", "executor_assignments", ["executor_id"])
    op.create_index("ix_executor_assignments_status", "executor_assignments", ["status"])
    op.create_index("ix_executor_assignments_archived", "executor_assignments", ["archived"])

    # Preserve existing single-executor data as the first assignment of every work.
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT w.id AS work_id, w.executor_id, w.character_count, w.page_count,
                   w.executor_billing_unit, w.executor_rate, w.executor_auto_cost,
                   w.executor_cost, w.executor_cost_overridden,
                   w.executor_deadline, w.executor_deadline_time, w.status,
                   COALESCE(p.amount_paid, 0) AS amount_paid, p.paid_at
            FROM order_works w
            LEFT JOIN executor_payments p ON p.work_id = w.id
            WHERE w.executor_id IS NOT NULL AND w.archived = false
            """
        )
    ).mappings().all()
    now = datetime.now(UTC)
    assignment_table = sa.table(
        "executor_assignments",
        sa.column("id", sa.String),
        sa.column("work_id", sa.String),
        sa.column("executor_id", sa.String),
        sa.column("character_count", sa.Integer),
        sa.column("page_count", sa.Numeric),
        sa.column("billing_unit", sa.String),
        sa.column("rate", sa.Numeric),
        sa.column("auto_cost", sa.Numeric),
        sa.column("cost", sa.Numeric),
        sa.column("cost_overridden", sa.Boolean),
        sa.column("amount_paid", sa.Numeric),
        sa.column("paid_at", sa.Date),
        sa.column("deadline", sa.Date),
        sa.column("deadline_time", sa.String),
        sa.column("status", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("notes", sa.Text),
        sa.column("archived", sa.Boolean),
        sa.column("version", sa.Integer),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    if rows:
        op.bulk_insert(
            assignment_table,
            [
                {
                    "id": str(uuid4()),
                    "work_id": row["work_id"],
                    "executor_id": row["executor_id"],
                    "character_count": row["character_count"],
                    "page_count": row["page_count"],
                    "billing_unit": row["executor_billing_unit"] or "CUSTOM",
                    "rate": row["executor_rate"] or 0,
                    "auto_cost": row["executor_auto_cost"] or 0,
                    "cost": row["executor_cost"] or 0,
                    "cost_overridden": bool(row["executor_cost_overridden"]),
                    "amount_paid": row["amount_paid"] or 0,
                    "paid_at": row["paid_at"],
                    "deadline": row["executor_deadline"],
                    "deadline_time": row["executor_deadline_time"] or "",
                    "status": row["status"] or "NEW",
                    "sort_order": 10,
                    "notes": "Мигрировано из прежнего назначения исполнителя",
                    "archived": False,
                    "version": 1,
                    "created_at": now,
                    "updated_at": now,
                }
                for row in rows
            ],
        )


def downgrade():
    op.drop_index("ix_executor_assignments_archived", table_name="executor_assignments")
    op.drop_index("ix_executor_assignments_status", table_name="executor_assignments")
    op.drop_index("ix_executor_assignments_executor_id", table_name="executor_assignments")
    op.drop_index("ix_executor_assignments_work_id", table_name="executor_assignments")
    op.drop_table("executor_assignments")
    op.drop_column("order_works", "discount_overridden")
    op.drop_column("order_works", "discount_percent")
    op.drop_column("order_works", "urgency_multiplier")

"""Clients, executors and independently assigned order work."""

import sqlalchemy as sa

from alembic import op

revision = "0005_operations"
down_revision = "0004_merge_stage_one"
branch_labels = None
depends_on = None


def metadata_columns():
    return [
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def link(name, target, nullable=True, **kwargs):
    return sa.Column(
        name, sa.String(36), sa.ForeignKey(target, ondelete="RESTRICT"), nullable=nullable, **kwargs
    )


def upgrade():
    op.add_column(
        "companies", sa.Column("kind", sa.String(20), nullable=False, server_default="company")
    )
    op.add_column(
        "companies", sa.Column("email", sa.String(320), nullable=False, server_default="")
    )
    op.add_column("companies", sa.Column("phone", sa.String(40), nullable=False, server_default=""))
    op.add_column("companies", link("manager_id", "users.id"))
    op.create_table(
        "executors",
        *metadata_columns(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(40), nullable=False),
        sa.Column("telegram", sa.String(160), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
    )
    op.create_table(
        "executor_directions",
        sa.Column(
            "executor_id",
            sa.String(36),
            sa.ForeignKey("executors.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("source_language", sa.String(80), primary_key=True),
        sa.Column("target_language", sa.String(80), primary_key=True),
        sa.Column("work_type", sa.String(64), primary_key=True),
    )
    op.create_table(
        "orders",
        *metadata_columns(),
        sa.Column("number", sa.String(32), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        link("client_id", "companies.id", False),
        link("contact_id", "representatives.id"),
        link("manager_id", "users.id", False),
        link("application_id", "applications.id", unique=True),
        sa.Column("deadline", sa.Date()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
    )
    op.create_table(
        "order_works",
        *metadata_columns(),
        link("order_id", "orders.id", False),
        sa.Column("work_type", sa.String(64), nullable=False),
        sa.Column("source_language", sa.String(80), nullable=False),
        sa.Column("target_language", sa.String(80), nullable=False),
        link("executor_id", "executors.id"),
        sa.Column("deadline", sa.Date()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("price", sa.Numeric(14, 2), nullable=False),
        sa.Column("executor_cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
    )
    op.create_table(
        "order_counters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("value", sa.Integer(), nullable=False),
    )
    op.execute("INSERT INTO order_counters (id, value) VALUES (1, 0)")
    op.create_table(
        "operational_activity",
        sa.Column("id", sa.String(36), primary_key=True),
        link("order_id", "orders.id"),
        link("executor_id", "executors.id"),
        link("work_id", "order_works.id"),
        link("actor_user_id", "users.id", False),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for table, columns in {
        "executors": ["name", "email", "archived"],
        "orders": ["number", "title", "client_id", "status", "archived"],
        "order_works": ["order_id", "executor_id", "status", "archived"],
        "operational_activity": ["order_id", "executor_id"],
    }.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    for table in [
        "operational_activity",
        "order_counters",
        "order_works",
        "orders",
        "executor_directions",
        "executors",
    ]:
        op.drop_table(table)
    for column in ["manager_id", "phone", "email", "kind"]:
        op.drop_column("companies", column)

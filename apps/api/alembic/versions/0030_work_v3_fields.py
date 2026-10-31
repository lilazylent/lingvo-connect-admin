"""Work fields of DOCX v3: volume provenance, final volume, document names, per-work
client documents and the topic dictionary.

Revision ID: 0030_work_v3_fields
Revises: 0029_order_deadline_mode

All new work columns are nullable or default to '' — historical works keep an unknown
('' = legacy) provenance instead of a guessed one. Existing order files stay attached to
the order (work_id NULL). The topic seed is idempotent.
"""

from datetime import UTC, datetime
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "0030_work_v3_fields"
down_revision = "0029_order_deadline_mode"
branch_labels = None
depends_on = None

TOPICS = [
    "банковская", "деловая", "инструкция", "косметика", "маркетинг", "медтехника", "медицинская",
    "налоговая", "общая", "одежда", "письма", "пищевая", "политика", "с/х", "спорт", "строительная",
    "судебная", "таможенная", "техническая", "туризм", "фармакология", "финансовая (трейдинг)",
    "финансовая", "химтехническая", "химическая", "художественная", "шаблонные документы",
    "экономическая", "ювелирная", "юридическая", "IT",
]


def upgrade() -> None:
    op.add_column("order_works", sa.Column("character_count_source", sa.String(length=16), nullable=False, server_default=""))
    op.add_column("order_works", sa.Column("measured_character_count", sa.Integer(), nullable=True))
    op.add_column("order_works", sa.Column("final_character_count", sa.Integer(), nullable=True))
    op.add_column("order_works", sa.Column("final_volume_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("order_works", sa.Column("document_names", sa.Text(), nullable=False, server_default=""))
    op.add_column("order_works", sa.Column("document_names_source", sa.String(length=16), nullable=False, server_default=""))
    with op.batch_alter_table("order_files") as batch:
        batch.add_column(sa.Column("work_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key("fk_order_files_work_id", "order_works", ["work_id"], ["id"], ondelete="RESTRICT")
        batch.create_index("ix_order_files_work_id", ["work_id"])

    op.create_table(
        "topic_catalog",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_topic_catalog_active", "topic_catalog", ["active"])
    bind = op.get_bind()
    existing = {row[0] for row in bind.execute(sa.text("SELECT name FROM topic_catalog"))}
    now = datetime.now(UTC)
    rows = [
        {"id": str(uuid4()), "name": name, "active": True, "sort_order": (index + 1) * 10, "created_at": now, "updated_at": now}
        for index, name in enumerate(TOPICS) if name not in existing
    ]
    if rows:
        op.bulk_insert(sa.table(
            "topic_catalog",
            sa.column("id", sa.String), sa.column("name", sa.String), sa.column("active", sa.Boolean),
            sa.column("sort_order", sa.Integer), sa.column("created_at", sa.DateTime(timezone=True)),
            sa.column("updated_at", sa.DateTime(timezone=True)),
        ), rows)


def downgrade() -> None:
    op.drop_index("ix_topic_catalog_active", table_name="topic_catalog")
    op.drop_table("topic_catalog")
    with op.batch_alter_table("order_files") as batch:
        batch.drop_index("ix_order_files_work_id")
        batch.drop_constraint("fk_order_files_work_id", type_="foreignkey")
        batch.drop_column("work_id")
    for column in ("document_names_source", "document_names", "final_volume_at", "final_character_count",
                   "measured_character_count", "character_count_source"):
        op.drop_column("order_works", column)

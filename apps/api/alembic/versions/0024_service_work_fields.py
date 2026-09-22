"""Phase 14 service-driven work fields and canonical service matrix.

Revision ID: 0024_service_work_fields
Revises: 0023_sync_tariffs_2026
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "0024_service_work_fields"
down_revision = "0023_sync_tariffs_2026"
branch_labels = None
depends_on = None


SERVICE_ROWS = [
    ("written_translation", "Письменный перевод", "CONDITIONAL_PAGE"),
    ("editing", "Редактура", "CONDITIONAL_PAGE"),
    ("proofreading", "Вычитка", "CONDITIONAL_PAGE"),
    ("typing", "Набор текста", "CONDITIONAL_PAGE"),
    ("notarial_certification", "Нотариальное заверение", "PER_DOCUMENT"),
    ("company_certification", 'Заверение печатью "Лингво Коннект"', "PER_DOCUMENT"),
    ("apostille", "Апостиль", "PER_DOCUMENT"),
    ("notarial_copy", "Нотариальная копия", "PER_PAGE"),
    ("text_layout", "Вёрстка текста", "PER_PAGE"),
    ("drawing_layout", "Вёрстка чертежей", "PER_PAGE"),
    ("recognition", "Распознавание", "PER_PAGE"),
    ("delivery", "Доставка", "FIXED"),
    ("audio_listening", "Аудирование", "PER_SECOND"),
    ("transcription", "Транскрибация", "CONDITIONAL_PAGE"),
    ("consecutive_interpreting", "Последовательный перевод", "HOURLY"),
    ("simultaneous_interpreting", "Синхронный перевод", "HOURLY"),
]


def _migrate_legacy_proofreading(bind) -> None:
    services = sa.table(
        "service_types",
        sa.column("id", sa.String),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("billing_mode", sa.String),
        sa.column("active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    legacy = bind.execute(sa.select(services).where(services.c.code == "native_proofreading")).mappings().first()
    canonical = bind.execute(sa.select(services).where(services.c.code == "proofreading")).mappings().first()
    if not legacy:
        return

    # String references are safe to canonicalise. Executor directions need a small
    # merge because (executor, language pair, work_type) is their composite PK.
    order_works = sa.table(
        "order_works", sa.column("service_code", sa.String), sa.column("work_type", sa.String)
    )
    bind.execute(order_works.update().where(order_works.c.service_code == "native_proofreading").values(service_code="proofreading"))
    bind.execute(order_works.update().where(order_works.c.work_type == "native_proofreading").values(work_type="proofreading"))

    # Tariffs/pricing rules keep their historical key. Runtime lookup is alias-aware,
    # which avoids violating tariff business-key uniqueness when both old and canonical
    # rows exist in an installation. New rows use the canonical proofreading code.

    directions = sa.table(
        "executor_directions",
        sa.column("executor_id", sa.String),
        sa.column("source_language", sa.String),
        sa.column("target_language", sa.String),
        sa.column("work_type", sa.String),
    )
    legacy_directions = bind.execute(
        sa.select(
            directions.c.executor_id,
            directions.c.source_language,
            directions.c.target_language,
        ).where(directions.c.work_type == "native_proofreading")
    ).all()
    for executor_id, source_language, target_language in legacy_directions:
        duplicate = bind.execute(
            sa.select(directions.c.executor_id).where(
                directions.c.executor_id == executor_id,
                directions.c.source_language == source_language,
                directions.c.target_language == target_language,
                directions.c.work_type == "proofreading",
            )
        ).first()
        predicate = sa.and_(
            directions.c.executor_id == executor_id,
            directions.c.source_language == source_language,
            directions.c.target_language == target_language,
            directions.c.work_type == "native_proofreading",
        )
        if duplicate:
            bind.execute(directions.delete().where(predicate))
        else:
            bind.execute(directions.update().where(predicate).values(work_type="proofreading"))

    now = datetime.now(timezone.utc)
    if canonical:
        bind.execute(
            services.update().where(services.c.id == legacy["id"]).values(
                active=False,
                name="Вычитка носителем (архив)",
                updated_at=now,
            )
        )
    else:
        bind.execute(
            services.update().where(services.c.id == legacy["id"]).values(
                code="proofreading",
                name="Вычитка",
                billing_mode="CONDITIONAL_PAGE",
                active=True,
                updated_at=now,
            )
        )


def _sync_services(bind) -> None:
    services = sa.table(
        "service_types",
        sa.column("id", sa.String),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("billing_mode", sa.String),
        sa.column("active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
        sa.column("notes", sa.Text),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    for index, (code, name, billing_mode) in enumerate(SERVICE_ROWS, start=1):
        existing = bind.execute(sa.select(services.c.id).where(services.c.code == code)).first()
        values = {
            "name": name,
            "billing_mode": billing_mode,
            "active": True,
            "sort_order": index * 10,
            "updated_at": now,
        }
        if existing:
            bind.execute(services.update().where(services.c.code == code).values(**values))
        else:
            bind.execute(
                services.insert().values(
                    id=str(uuid.uuid4()),
                    code=code,
                    notes="Phase 14 · матрица регистрации заказов",
                    created_at=now,
                    **values,
                )
            )

    # These pre-matrix helper services are not separate columns in Oleg's matrix.
    # Historical works remain readable; new orders should use the canonical list.
    bind.execute(
        services.update().where(services.c.code.in_(["scan", "native_proofreading"])).values(
            active=False, updated_at=now
        )
    )


def upgrade() -> None:
    op.add_column("order_works", sa.Column("document_count", sa.Integer(), nullable=True))
    op.add_column("order_works", sa.Column("duration_seconds", sa.Integer(), nullable=True))
    op.add_column("order_works", sa.Column("hour_count", sa.Numeric(10, 2), nullable=True))
    op.add_column("order_works", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("order_works", sa.Column("start_time", sa.String(length=5), nullable=False, server_default=""))
    op.add_column("order_works", sa.Column("certification_mode", sa.String(length=20), nullable=False, server_default=""))

    op.add_column("executor_assignments", sa.Column("document_count", sa.Integer(), nullable=True))
    op.add_column("executor_assignments", sa.Column("duration_seconds", sa.Integer(), nullable=True))
    op.add_column("executor_assignments", sa.Column("hour_count", sa.Numeric(10, 2), nullable=True))

    bind = op.get_bind()
    _migrate_legacy_proofreading(bind)
    _sync_services(bind)


def downgrade() -> None:
    op.drop_column("executor_assignments", "hour_count")
    op.drop_column("executor_assignments", "duration_seconds")
    op.drop_column("executor_assignments", "document_count")

    op.drop_column("order_works", "certification_mode")
    op.drop_column("order_works", "start_time")
    op.drop_column("order_works", "start_date")
    op.drop_column("order_works", "hour_count")
    op.drop_column("order_works", "duration_seconds")
    op.drop_column("order_works", "document_count")

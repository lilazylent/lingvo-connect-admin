"""Synchronize written-translation tariffs with the authoritative 2026 sheet.

Revision ID: 0012_exact_2026_translation_tariffs
Revises: 0011_order_work_tariffs
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "0012_exact_2026_translation_tariffs"
down_revision = "0011_order_work_tariffs"
branch_labels = None
depends_on = None

SOURCE_NOTE = "Тарифы Лингво Коннект 2026 — подтверждено по таблице клиента"
LEGACY_NOTE = "Тарифы Лингво Коннект 2026"

LANGUAGE_TARIFFS = [
    ("Английский", 540, 590, 2200),
    ("Азербайджанский", 690, 790, None),
    ("Албанский", 890, 990, 2200),
    ("Арабский", 1090, 1290, 2200),
    ("Армянский", 690, 790, None),
    ("Белорусский", 540, 590, None),
    ("Болгарский", 790, 890, 2200),
    ("Венгерский", 890, 990, 2200),
    ("Вьетнамский", 1090, 1290, 2200),
    ("Греческий", 890, 990, 2200),
    ("Грузинский", 790, 890, 2200),
    ("Датский", 940, 1040, 2200),
    ("Иврит", 1090, 1290, 2200),
    ("Индонезийский", 1090, 1290, 2200),
    ("Испанский", 690, 790, 2200),
    ("Итальянский", 690, 790, 2200),
    ("Казахский", 690, 790, None),
    ("Киргизский", 690, 790, None),
    ("Китайский", 1090, 1290, 2200),
    ("Корейский", 1090, 1290, 2200),
    ("Латышский", 940, 1040, 2200),
    ("Литовский", 940, 1040, 2200),
    ("Немецкий", 690, 790, 2200),
    ("Нидерландский", 940, 1040, 2200),
    ("Норвежский", 940, 1040, 2200),
    ("Польский", 790, 890, 2200),
    ("Португальский", 790, 890, 2200),
    ("Румынский", 790, 890, 2200),
    ("Сербский", 790, 890, 2200),
    ("Словацкий", 790, 890, 2200),
    ("Словенский", 790, 890, 2200),
    ("Таджикский", 690, 790, None),
    ("Тайский", 1090, 1290, 2200),
    ("Турецкий", 940, 1040, 2200),
    ("Туркменский", 690, 790, None),
    ("Узбекский", 690, 790, None),
    ("Украинский", 540, 590, None),
    ("Фарси", 1090, 1290, 2200),
    ("Финский", 940, 1040, 2200),
    ("Французский", 690, 790, 2200),
    ("Хинди", 1090, 1290, 2200),
    ("Хорватский", 790, 890, 2200),
    ("Чешский", 790, 890, 2200),
    ("Шведский", 940, 1040, 2200),
    ("Эстонский", 940, 1040, 2200),
    ("Японский", 1090, 1290, 2200),
]


def _desired_rows():
    for language, to_russian, from_russian, native in LANGUAGE_TARIFFS:
        yield (language, "Русский", "TO_RUSSIAN", to_russian)
        yield ("Русский", language, "FROM_RUSSIAN", from_russian)
        if native is not None:
            yield ("", language, "NATIVE_SPEAKER", native)


def upgrade():
    bind = op.get_bind()
    now = datetime.now(timezone.utc)
    tariffs = sa.table(
        "tariffs",
        sa.column("id", sa.String), sa.column("service_code", sa.String),
        sa.column("source_language", sa.String), sa.column("target_language", sa.String),
        sa.column("direction", sa.String), sa.column("unit", sa.String),
        sa.column("amount", sa.Numeric), sa.column("min_quantity", sa.Numeric),
        sa.column("urgency_multiplier", sa.Numeric), sa.column("native_multiplier", sa.Numeric),
        sa.column("active_from", sa.Date), sa.column("active_to", sa.Date),
        sa.column("active", sa.Boolean), sa.column("notes", sa.Text),
        sa.column("created_at", sa.DateTime(timezone=True)), sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    desired_keys = set()
    for source, target, direction, amount in _desired_rows():
        key = (source, target, direction)
        desired_keys.add(key)
        where_key = sa.and_(
            tariffs.c.service_code == "written_translation",
            tariffs.c.source_language == source,
            tariffs.c.target_language == target,
            tariffs.c.direction == direction,
            tariffs.c.unit == "CONDITIONAL_PAGE",
            tariffs.c.active_from.is_(None),
            tariffs.c.notes.in_([LEGACY_NOTE, SOURCE_NOTE]),
        )
        ids = [row[0] for row in bind.execute(sa.select(tariffs.c.id).where(where_key)).all()]
        values = dict(
            amount=amount,
            min_quantity=1,
            urgency_multiplier=1.5,
            native_multiplier=1,
            active_to=None,
            active=True,
            notes=SOURCE_NOTE,
            updated_at=now,
        )
        if ids:
            bind.execute(sa.update(tariffs).where(tariffs.c.id.in_(ids)).values(**values))
        else:
            bind.execute(tariffs.insert().values(
                id=str(uuid.uuid4()), service_code="written_translation",
                source_language=source, target_language=target, direction=direction,
                unit="CONDITIONAL_PAGE", active_from=None, created_at=now, **values,
            ))

    # Deactivate only old seeded 2026 rows that are not present in the authoritative table.
    seeded = bind.execute(sa.select(
        tariffs.c.id, tariffs.c.source_language, tariffs.c.target_language, tariffs.c.direction
    ).where(
        tariffs.c.service_code == "written_translation",
        tariffs.c.unit == "CONDITIONAL_PAGE",
        tariffs.c.notes.in_([LEGACY_NOTE, SOURCE_NOTE]),
        tariffs.c.active_from.is_(None),
    )).all()
    stale_ids = [row.id for row in seeded if (row.source_language, row.target_language, row.direction) not in desired_keys]
    if stale_ids:
        bind.execute(sa.update(tariffs).where(tariffs.c.id.in_(stale_ids)).values(active=False, updated_at=now))

    rules = sa.table(
        "pricing_rules",
        sa.column("id", sa.String), sa.column("code", sa.String), sa.column("name", sa.String),
        sa.column("rule_type", sa.String), sa.column("service_code", sa.String),
        sa.column("threshold_from", sa.Numeric), sa.column("threshold_to", sa.Numeric),
        sa.column("percent", sa.Numeric), sa.column("multiplier", sa.Numeric),
        sa.column("active", sa.Boolean), sa.column("notes", sa.Text),
        sa.column("created_at", sa.DateTime(timezone=True)), sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    exact_rules = [
        ("volume_discount_5", "Скидка 5%: 20–99 усл. страниц", 20, 99, 5),
        ("volume_discount_10", "Скидка 10%: 100–499 усл. страниц", 100, 499, 10),
        ("volume_discount_15", "Скидка 15%: от 500 усл. страниц", 500, None, 15),
    ]
    for code, name, low, high, percent in exact_rules:
        exists = bind.execute(sa.select(rules.c.id).where(rules.c.code == code)).scalar_one_or_none()
        values = dict(
            name=name, rule_type="VOLUME_DISCOUNT", service_code="written_translation",
            threshold_from=low, threshold_to=high, percent=percent, multiplier=1,
            active=True, notes=SOURCE_NOTE, updated_at=now,
        )
        if exists:
            bind.execute(sa.update(rules).where(rules.c.id == exists).values(**values))
        else:
            bind.execute(rules.insert().values(id=str(uuid.uuid4()), code=code, created_at=now, **values))


def downgrade():
    # Data synchronization is intentionally non-destructive on downgrade.
    pass

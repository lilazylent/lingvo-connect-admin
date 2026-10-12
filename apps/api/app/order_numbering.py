"""Year-scoped order numbering.

Order numbers are immutable public identifiers in the ``YY-NNNN`` format.
The numeric sequence resets for each order execution year (overall deadline year). The existing
``order_counters`` table is reused with ``id == full year`` (for example 2026)
and Phase 12 owner-correction migration 0021 aligns historical rows/counters.
"""

from __future__ import annotations

import re
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import case, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import utcnow
from app.operations_models import Order, OrderCounter


def _ensure_year_counter(db: Session, year: int) -> None:
    table = OrderCounter.__table__
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        db.execute(
            pg_insert(table)
            .values(id=year, value=0)
            .on_conflict_do_nothing(index_elements=[table.c.id])
        )
        return
    if dialect == "sqlite":
        db.execute(
            sqlite_insert(table)
            .values(id=year, value=0)
            .on_conflict_do_nothing(index_elements=[table.c.id])
        )
        return

    if db.get(OrderCounter, year) is not None:
        return
    try:
        with db.begin_nested():
            db.add(OrderCounter(id=year, value=0))
            db.flush()
    except IntegrityError:
        # Another transaction initialized the same year's row first.
        pass



def format_order_number(year: int, sequence: int) -> str:
    """Format the immutable public order number required by the owner.

    Example: 2026 / 1 -> ``26-0001``.
    """
    if year < 2000 or year > 9999:
        raise HTTPException(422, "Некорректный год исполнения заказа")
    if sequence < 1 or sequence > 9999:
        raise HTTPException(409, f"Некорректный порядковый номер заказа: {sequence}")
    return f"{year % 100:02d}-{sequence:04d}"


def peek_next_order_number(
    db: Session, *, execution_year: int | None = None, now: datetime | None = None
) -> str:
    """Return the next visible draft number without reserving it.

    This function is intentionally read-only. Opening/closing the new-order wizard
    must never consume a public number; only ``next_order_number`` does that inside
    the actual create transaction.
    """
    moment = now or utcnow()
    year = execution_year or moment.year
    if year < 2000 or year > 9999:
        raise HTTPException(422, "Некорректный год исполнения заказа")
    row = db.get(OrderCounter, year)
    current = int(row.value) if row is not None else 0
    return format_order_number(year, current + 1)


def next_order_number(
    db: Session, *, execution_year: int | None = None, now: datetime | None = None
) -> str:
    """Return the next concurrency-safe order number for the execution year.

    When the order has no known deadline yet, the current calendar year is used.
    ``now`` is retained as a deterministic test hook for the no-deadline fallback.
    """

    moment = now or utcnow()
    year = execution_year or moment.year
    if year < 2000 or year > 9999:
        raise HTTPException(422, "Некорректный год исполнения заказа")
    _ensure_year_counter(db, year)
    sequence = db.scalar(
        update(OrderCounter)
        .where(OrderCounter.id == year)
        .values(value=OrderCounter.value + 1)
        .returning(OrderCounter.value)
    )
    if sequence is None:
        raise HTTPException(503, "Не удалось инициализировать счётчик заказов")
    if sequence > 9999:
        raise HTTPException(409, f"Исчерпан диапазон номеров заказов за {year} год")
    return format_order_number(year, sequence)


ORDER_NUMBER_PATTERN = re.compile(r"^(\d{2})-(\d{4})$")


def claim_explicit_order_number(db: Session, number: str, *, exclude_order_id: str | None = None) -> str:
    """Validate a manually entered ``YY-NNNN`` number and keep the counter ahead of it.

    The owner may type the number while registering or editing an order. The counter for
    that year is raised (never lowered) so later automatic numbers cannot collide with it.
    """
    value = (number or "").strip()
    match = ORDER_NUMBER_PATTERN.match(value)
    if not match:
        raise HTTPException(422, "Номер заказа должен быть в формате ГГ-NNNN, например 26-0123")
    year, sequence = 2000 + int(match.group(1)), int(match.group(2))
    if sequence < 1:
        raise HTTPException(422, "Порядковый номер заказа должен быть больше нуля")
    taken = db.scalar(select(Order.id).where(Order.number == value, *([Order.id != exclude_order_id] if exclude_order_id else [])))
    if taken:
        raise HTTPException(409, f"Номер {value} уже занят другим заказом")
    _ensure_year_counter(db, year)
    db.execute(
        update(OrderCounter)
        .where(OrderCounter.id == year)
        .values(value=case((OrderCounter.value < sequence, sequence), else_=OrderCounter.value))
    )
    return value

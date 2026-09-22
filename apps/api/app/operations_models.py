"""Operational records. A request remains independent of the accepted order."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import new_uuid, utcnow


class RecordMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Executor(RecordMixin, Base):
    __tablename__ = "executors"
    name: Mapped[str] = mapped_column(String(200), index=True)
    email: Mapped[str] = mapped_column(String(320), default="", index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    telegram: Mapped[str] = mapped_column(String(160), default="")
    notes: Mapped[str] = mapped_column(Text, default="")


class ExecutorDirection(Base):
    __tablename__ = "executor_directions"
    executor_id: Mapped[str] = mapped_column(
        ForeignKey("executors.id", ondelete="CASCADE"), primary_key=True
    )
    source_language: Mapped[str] = mapped_column(String(80), primary_key=True)
    target_language: Mapped[str] = mapped_column(String(80), primary_key=True)
    work_type: Mapped[str] = mapped_column(String(64), primary_key=True)
    default_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    rate_unit: Mapped[str] = mapped_column(String(32), default="CONDITIONAL_PAGE")


class ExecutorAvailability(RecordMixin, Base):
    """Persisted executor availability interval used by Phase 10 matching.

    Intervals are inclusive date ranges. The API prevents overlapping active
    intervals so future matching has one deterministic availability state for
    any calendar date. Absence of an interval means availability is unknown,
    never implicitly FREE.
    """

    __tablename__ = "executor_availability"
    executor_id: Mapped[str] = mapped_column(
        ForeignKey("executors.id", ondelete="CASCADE"), index=True
    )
    state: Mapped[str] = mapped_column(String(20), index=True)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class Order(RecordMixin, Base):
    __tablename__ = "orders"
    number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    client_id: Mapped[str | None] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    contact_id: Mapped[str | None] = mapped_column(
        ForeignKey("representatives.id", ondelete="RESTRICT"), nullable=True
    )
    manager_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    application_id: Mapped[str | None] = mapped_column(
        ForeignKey("applications.id", ondelete="RESTRICT"), nullable=True, unique=True
    )
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="NEW", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class OrderWork(RecordMixin, Base):
    __tablename__ = "order_works"
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"), index=True)
    work_type: Mapped[str] = mapped_column(String(64))
    service_code: Mapped[str] = mapped_column(String(64), default="written_translation", index=True)
    source_language: Mapped[str] = mapped_column(String(80), default="")
    target_language: Mapped[str] = mapped_column(String(80), default="")
    topic: Mapped[str] = mapped_column(String(160), default="")
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    urgency_multiplier: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("1.50"))
    native_speaker: Mapped[bool] = mapped_column(Boolean, default=False)
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0"))
    discount_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    tariff_ids: Mapped[str] = mapped_column(Text, default="")
    character_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_count: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    document_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hour_count: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[str] = mapped_column(String(5), default="")
    certification_mode: Mapped[str] = mapped_column(String(20), default="")
    billing_unit: Mapped[str] = mapped_column(String(32), default="CUSTOM")
    client_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    auto_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    price_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    price_override_reason: Mapped[str] = mapped_column(String(500), default="")
    client_billable: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    executor_id: Mapped[str | None] = mapped_column(
        ForeignKey("executors.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    executor_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    executor_billing_unit: Mapped[str] = mapped_column(String(32), default="CUSTOM")
    executor_auto_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    executor_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    executor_cost_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    deadline_time: Mapped[str] = mapped_column(String(5), default="")
    executor_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    executor_deadline_time: Mapped[str] = mapped_column(String(5), default="")
    status: Mapped[str] = mapped_column(String(32), default="NEW", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    notes: Mapped[str] = mapped_column(Text, default="")


class ExecutorAssignment(RecordMixin, Base):
    """Executor-specific slice of a client work.

    Client volume/pricing remains on OrderWork. Assignments track the real volume and
    cost handled by each executor so split work does not distort statistics.
    """

    __tablename__ = "executor_assignments"
    work_id: Mapped[str] = mapped_column(ForeignKey("order_works.id", ondelete="RESTRICT"), index=True)
    executor_id: Mapped[str] = mapped_column(ForeignKey("executors.id", ondelete="RESTRICT"), index=True)
    character_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_count: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    document_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hour_count: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    billing_unit: Mapped[str] = mapped_column(String(32), default="CONDITIONAL_PAGE")
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    auto_cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    cost_overridden: Mapped[bool] = mapped_column(Boolean, default=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline_time: Mapped[str] = mapped_column(String(5), default="")
    route_stage_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    route_source_language: Mapped[str] = mapped_column(String(80), default="")
    route_target_language: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(32), default="NEW", index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    notes: Mapped[str] = mapped_column(Text, default="")


class OrderCounter(Base):
    """Year-scoped order counter: ``id`` stores the full calendar year."""

    __tablename__ = "order_counters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    value: Mapped[int] = mapped_column(Integer, default=0)


class ApplicationClient(Base):
    __tablename__ = "application_clients"
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="RESTRICT"), primary_key=True
    )
    client_id: Mapped[str | None] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True, index=True
    )


class OperationalActivity(Base):
    __tablename__ = "operational_activity"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str | None] = mapped_column(
        ForeignKey("orders.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    executor_id: Mapped[str | None] = mapped_column(
        ForeignKey("executors.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    work_id: Mapped[str | None] = mapped_column(
        ForeignKey("order_works.id", ondelete="RESTRICT"), nullable=True
    )
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

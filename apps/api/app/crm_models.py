"""CRM pricing, payments and service catalog for Lingvo Connect."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import new_uuid, utcnow


class ServiceType(Base):
    __tablename__ = "service_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    billing_mode: Mapped[str] = mapped_column(String(40), default="CUSTOM")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LanguageCatalog(Base):
    """Canonical language dictionary shared by tariffs, orders and executors.

    Existing operational rows still store the human-readable language name.  Phase 06
    centralises which names may be selected without inventing ISO codes that were not
    provided by the business.
    """

    __tablename__ = "language_catalog"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OrderStatusOption(Base):
    __tablename__ = "order_status_options"

    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(20), default="slate")
    board: Mapped[str] = mapped_column(String(20), default="MAIN", index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Tariff(Base):
    __tablename__ = "tariffs"
    __table_args__ = (
        UniqueConstraint(
            "service_code", "source_language", "target_language", "direction", "unit", "active_from",
            name="uq_tariff_business_key",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    service_code: Mapped[str] = mapped_column(String(64), index=True)
    source_language: Mapped[str] = mapped_column(String(80), default="", index=True)
    target_language: Mapped[str] = mapped_column(String(80), default="", index=True)
    direction: Mapped[str] = mapped_column(String(32), default="ANY", index=True)
    unit: Mapped[str] = mapped_column(String(32), default="CONDITIONAL_PAGE")
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    min_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0"))
    urgency_multiplier: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("1.50"))
    native_multiplier: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("1.00"))
    active_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    active_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    rule_type: Mapped[str] = mapped_column(String(40), index=True)
    service_code: Mapped[str] = mapped_column(String(64), default="", index=True)
    threshold_from: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    threshold_to: Mapped[Decimal | None] = mapped_column(Numeric(14, 4), nullable=True)
    percent: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0"))
    multiplier: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("1"))
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClientPayment(Base):
    __tablename__ = "client_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"), unique=True, index=True)
    amount_due: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    payment_method: Mapped[str] = mapped_column(String(64), default="")
    invoice_number: Mapped[str] = mapped_column(String(80), default="")
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ExecutorPayment(Base):
    __tablename__ = "executor_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    work_id: Mapped[str] = mapped_column(ForeignKey("order_works.id", ondelete="RESTRICT"), unique=True, index=True)
    executor_id: Mapped[str | None] = mapped_column(ForeignKey("executors.id", ondelete="RESTRICT"), nullable=True, index=True)
    amount_due: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

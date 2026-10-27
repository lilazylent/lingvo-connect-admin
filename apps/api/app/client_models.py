"""Persistent company directory, independent from incoming application contact text."""

from datetime import datetime

from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import new_uuid, utcnow


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="company")
    email: Mapped[str] = mapped_column(String(320), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    manager_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    tax_id: Mapped[str | None] = mapped_column(String(12), nullable=True, unique=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deposit_balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    # Owner feedback 2026-10-27: some clients have their own price list.
    # STANDARD = company tariffs by default, CLIENT = this client's tariffs by default.
    pricing_mode: Mapped[str] = mapped_column(String(20), default="STANDARD")
    # Discount granted to the client (e.g. for a prepaid deposit), applied with client tariffs.
    client_discount_percent: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0"))


class ClientDepositTransaction(Base):
    __tablename__ = "client_deposit_transactions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)
    order_id: Mapped[str | None] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"), nullable=True, unique=True)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    note: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class ClientTariff(Base):
    """A client-specific price for one service (optionally one language pair).

    Several rows of the same service/variant/languages form a price ladder:
    the row with the highest ``quantity_from`` not above the work quantity applies
    (e.g. notarisation 500 ₽ from 1 document, 450 ₽ from 5 documents).
    """

    __tablename__ = "client_tariffs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)
    service_code: Mapped[str] = mapped_column(String(64), index=True)
    variant: Mapped[str] = mapped_column(String(20), default="")
    source_language: Mapped[str] = mapped_column(String(80), default="")
    target_language: Mapped[str] = mapped_column(String(80), default="")
    quantity_from: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    notes: Mapped[str] = mapped_column(String(500), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Representative(Base):
    __tablename__ = "representatives"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    position: Mapped[str] = mapped_column(String(160), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClientActivity(Base):
    __tablename__ = "client_activity"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    company_id: Mapped[str] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), index=True
    )
    representative_id: Mapped[str | None] = mapped_column(
        ForeignKey("representatives.id", ondelete="RESTRICT"), nullable=True
    )
    actor_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    action: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

"""Persistent company directory, independent from incoming application contact text."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
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

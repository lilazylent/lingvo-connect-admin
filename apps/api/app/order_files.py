from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import new_uuid, utcnow


class OrderFile(Base):
    __tablename__ = "order_files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id", ondelete="RESTRICT"), index=True)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    character_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    analysis_status: Mapped[str] = mapped_column(String(32), default="PENDING")
    analysis_note: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

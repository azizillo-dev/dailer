import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, new_id
from app.models.user import pg_enum

QURAN_PAGES = 604


class BookStatus(str, enum.Enum):
    planned = "planned"
    reading = "reading"
    paused = "paused"
    finished = "finished"


class Book(TimestampMixin, Base):
    __tablename__ = "books"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    author: Mapped[str | None] = mapped_column(String(120))
    total_pages: Mapped[int] = mapped_column(Integer)
    current_page: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[BookStatus] = mapped_column(pg_enum(BookStatus, "book_status"), default=BookStatus.reading)
    started_on: Mapped[date | None] = mapped_column(Date)
    finished_on: Mapped[date | None] = mapped_column(Date)


class ReadingLog(Base):
    __tablename__ = "reading_logs"
    __table_args__ = (UniqueConstraint("book_id", "date", name="uq_reading_log_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    book_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    pages: Mapped[int] = mapped_column(Integer, default=0)


class QuranProgress(TimestampMixin, Base):
    __tablename__ = "quran_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    current_page: Mapped[int] = mapped_column(SmallInteger, default=0)  # 0..604
    khatm_count: Mapped[int] = mapped_column(SmallInteger, default=0)
    daily_target_pages: Mapped[int] = mapped_column(SmallInteger, default=2)


class QuranLog(Base):
    __tablename__ = "quran_logs"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_quran_log_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    date: Mapped[date] = mapped_column(Date)
    pages: Mapped[int] = mapped_column(Integer, default=0)


class DhikrCounter(TimestampMixin, Base):
    __tablename__ = "dhikr_counters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    target: Mapped[int] = mapped_column(Integer, default=33)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class DhikrLog(Base):
    __tablename__ = "dhikr_logs"
    __table_args__ = (UniqueConstraint("counter_id", "date", name="uq_dhikr_log_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    counter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dhikr_counters.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    count: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

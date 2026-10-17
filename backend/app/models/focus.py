import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id
from app.models.user import pg_enum


class FocusKind(str, enum.Enum):
    focus = "focus"
    short_break = "short_break"
    long_break = "long_break"


class PomodoroSession(Base):
    __tablename__ = "pomodoro_sessions"
    __table_args__ = (Index("ix_pomodoro_user_date", "user_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    routine_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("routine_items.id", ondelete="SET NULL")
    )
    kind: Mapped[FocusKind] = mapped_column(pg_enum(FocusKind, "focus_kind"), default=FocusKind.focus)
    # Mahalliy sana (statistika uchun)
    date: Mapped[date] = mapped_column(Date)
    planned_min: Mapped[int] = mapped_column(SmallInteger)
    actual_min: Mapped[int] = mapped_column(SmallInteger)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed: Mapped[bool] = mapped_column(Boolean, default=True)
    interruptions: Mapped[int] = mapped_column(SmallInteger, default=0)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)

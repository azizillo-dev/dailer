import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id


class DayReflection(Base):
    """Kechki refleksiya: kayfiyat, energiya, bir jumla va uyqu vaqtlari."""

    __tablename__ = "day_reflections"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_reflection_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    mood: Mapped[int | None] = mapped_column(SmallInteger)  # 1–5
    energy: Mapped[int | None] = mapped_column(SmallInteger)  # 1–5
    note: Mapped[str | None] = mapped_column(Text)
    # Shu kunga olib kelgan tun: kecha yotgan va bugun turgan vaqt
    slept_at: Mapped[time | None] = mapped_column(Time)
    woke_at: Mapped[time | None] = mapped_column(Time)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StreakFreeze(Base):
    """Zanjirni uzmaydigan kun (oyiga cheklangan)."""

    __tablename__ = "streak_freezes"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_streak_freeze_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id


class ScreenTimeDay(Base):
    """Bir kunlik telefon ekran vaqti.

    Android'da ilova o'zi yig'adi (UsageStatsManager), iPhone/web'da foydalanuvchi qo'lda kiritadi.
    apps — eng ko'p ishlatilgan ilovalar: [{"id": "com.instagram.android", "name": "Instagram", "minutes": 42}]
    """

    __tablename__ = "screen_time_days"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_screen_time_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date: Mapped[date] = mapped_column(Date)
    total_min: Mapped[int] = mapped_column(Integer)
    pickups: Mapped[int | None] = mapped_column(Integer)
    apps: Mapped[list] = mapped_column(JSONB, default=list)
    source: Mapped[str] = mapped_column(String(16), default="manual")  # android | manual
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

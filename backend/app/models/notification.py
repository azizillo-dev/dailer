import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id
from app.models.user import pg_enum


class NotificationKind(str, enum.Enum):
    evening_summary = "evening_summary"
    goal_reminder = "goal_reminder"
    never_miss_twice = "never_miss_twice"
    streak_risk = "streak_risk"
    campaign = "campaign"
    system = "system"


class Notification(Base):
    """Ilova ichidagi xabarlar qutisi (push yuborilgan-yuborilmaganidan qat'i nazar)."""

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[NotificationKind] = mapped_column(pg_enum(NotificationKind, "notification_kind"))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Bir martalik xabarlar kaliti ("evening:<user>:<sana>") — takroriy cron chaqiruvi dublikat yaratmaydi
    dedupe_key: Mapped[str | None] = mapped_column(String(120), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

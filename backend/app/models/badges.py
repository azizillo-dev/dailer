import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, new_id


class UserBadge(Base):
    """Olingan nishon. Qoidalar kodda (services/badges.py), bu yerda — faqat olingan vaqt."""

    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "code", name="uq_user_badge"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(48))
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

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
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, new_id
from app.models.user import pg_enum


class ChallengeKind(str, enum.Enum):
    language_words = "language_words"
    reading_pages = "reading_pages"
    custom = "custom"


class ChallengeVisibility(str, enum.Enum):
    private = "private"
    public = "public"


class Challenge(TimestampMixin, Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    # NULL — admin e'lon qilgan umumiy challenge
    creator_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[ChallengeKind] = mapped_column(pg_enum(ChallengeKind, "challenge_kind"))
    title: Mapped[dict] = mapped_column(JSONB)
    description: Mapped[dict] = mapped_column(JSONB, default=dict)
    language_code: Mapped[str | None] = mapped_column(String(8))
    target_value: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(24))
    duration_days: Mapped[int] = mapped_column(SmallInteger)
    # Umumiy challenge uchun qat'iy sanalar; shaxsiyda — har kim qo'shilgan kunidan
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    visibility: Mapped[ChallengeVisibility] = mapped_column(
        pg_enum(ChallengeVisibility, "challenge_visibility"), default=ChallengeVisibility.private
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ChallengeParticipant(Base):
    __tablename__ = "challenge_participants"
    __table_args__ = (UniqueConstraint("challenge_id", "user_id", name="uq_challenge_participant"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    challenge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("challenges.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    personal_start: Mapped[date] = mapped_column(Date)
    progress_total: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    show_on_profile: Mapped[bool] = mapped_column(Boolean, default=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChallengeLog(Base):
    __tablename__ = "challenge_logs"
    __table_args__ = (UniqueConstraint("participant_id", "date", name="uq_challenge_log_day"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("challenge_participants.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date)
    value: Mapped[int] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text)

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
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, new_id
from app.models.user import pg_enum


class AIRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class AIReportKind(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"


class AIProvider(TimestampMixin, Base):
    """Zanjirdagi provayder. Kalit bazada emas — `api_key_env` dagi env o'zgaruvchida."""

    __tablename__ = "ai_providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(64))
    base_url: Mapped[str] = mapped_column(String(255))
    model: Mapped[str] = mapped_column(String(128))
    priority: Mapped[int] = mapped_column(SmallInteger, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    # O'zimiz qo'ygan xavfsiz kunlik chegara (provayder limitidan biroz past)
    daily_request_cap: Mapped[int | None] = mapped_column(Integer)
    api_key_env: Mapped[str] = mapped_column(String(64))


class AIConversation(TimestampMixin, Base):
    __tablename__ = "ai_conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120), default="")
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[AIRole] = mapped_column(pg_enum(AIRole, "ai_role"))
    content: Mapped[str] = mapped_column(Text)
    provider_code: Mapped[str | None] = mapped_column(String(32))
    model: Mapped[str | None] = mapped_column(String(128))
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    # 0 — birinchi provayder javob berdi; -1 — shablon javob
    fallback_level: Mapped[int | None] = mapped_column(SmallInteger)
    rating: Mapped[int | None] = mapped_column(SmallInteger)  # 1 = 👍, -1 = 👎
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIReport(Base):
    __tablename__ = "ai_reports"
    __table_args__ = (UniqueConstraint("user_id", "kind", "period_start", name="uq_ai_reports_period"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[AIReportKind] = mapped_column(pg_enum(AIReportKind, "ai_report_kind"))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    stats_snapshot: Mapped[dict] = mapped_column(JSONB)
    content: Mapped[str] = mapped_column(Text)
    provider_code: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, new_id
from app.models.user import pg_enum


class MotivationCategory(str, enum.Enum):
    discipline = "discipline"
    time = "time"
    faith = "faith"
    study = "study"
    sport = "sport"
    general = "general"


class BannerKind(str, enum.Enum):
    ad = "ad"
    news = "news"
    announcement = "announcement"
    motivation = "motivation"


class BannerPlacement(str, enum.Enum):
    home_top = "home_top"
    motivations = "motivations"
    profile = "profile"
    stats = "stats"


class BannerEventType(str, enum.Enum):
    impression = "impression"
    click = "click"


class Motivation(TimestampMixin, Base):
    __tablename__ = "motivations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    text: Mapped[dict] = mapped_column(JSONB)  # {"uz": "...", "ru": "...", "en": "..."}
    author: Mapped[str | None] = mapped_column(String(120))
    category: Mapped[MotivationCategory] = mapped_column(
        pg_enum(MotivationCategory, "motivation_category"), default=MotivationCategory.general
    )
    image_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Shu sanada "kun motivatsiyasi" sifatida chiqadi
    publish_on: Mapped[date | None] = mapped_column(Date, index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Banner(TimestampMixin, Base):
    __tablename__ = "banners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    kind: Mapped[BannerKind] = mapped_column(pg_enum(BannerKind, "banner_kind"), default=BannerKind.news)
    title: Mapped[dict] = mapped_column(JSONB)
    subtitle: Mapped[dict] = mapped_column(JSONB, default=dict)
    image_mobile_url: Mapped[str | None] = mapped_column(Text)
    image_desktop_url: Mapped[str | None] = mapped_column(Text)
    link_url: Mapped[str | None] = mapped_column(Text)
    cta: Mapped[dict] = mapped_column(JSONB, default=dict)
    placement: Mapped[BannerPlacement] = mapped_column(
        pg_enum(BannerPlacement, "banner_placement"), default=BannerPlacement.home_top
    )
    # {"languages": ["uz"], "user_types": ["school_pupil"], "platforms": ["android"]}; bo'sh = hamma
    audience: Mapped[dict] = mapped_column(JSONB, default=dict)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    priority: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class BannerEvent(Base):
    __tablename__ = "banner_events"
    __table_args__ = (Index("ix_banner_events_banner_created", "banner_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    banner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("banners.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    event: Mapped[BannerEventType] = mapped_column(pg_enum(BannerEventType, "banner_event_type"))
    platform: Mapped[str | None] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    diff: Mapped[dict] = mapped_column(JSONB, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

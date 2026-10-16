import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_id
from app.models.user import pg_enum

# Hafta kunlari bitmask: Du=1, Se=2, Ch=4, Pa=8, Ju=16, Sh=32, Ya=64
ALL_DAYS = 127
WEEKDAYS = 31
WEEKEND = 96


def day_bit(d: date) -> int:
    return 1 << d.weekday()


class Category(str, enum.Enum):
    prayer = "prayer"
    reading = "reading"
    sport = "sport"
    study = "study"
    language = "language"
    quran = "quran"
    dhikr = "dhikr"
    sleep = "sleep"
    health = "health"
    work = "work"
    custom = "custom"


class PrayerName(str, enum.Enum):
    fajr = "fajr"
    dhuhr = "dhuhr"
    asr = "asr"
    maghrib = "maghrib"
    isha = "isha"


class ModeType(str, enum.Enum):
    weekday = "weekday"
    weekend = "weekend"
    exam = "exam"
    vacation = "vacation"
    ramadan = "ramadan"
    custom = "custom"


class AlarmType(str, enum.Enum):
    notification = "notification"
    alarm = "alarm"
    strict_alarm = "strict_alarm"


class CheckinStatus(str, enum.Enum):
    done = "done"
    partial = "partial"
    missed = "missed"
    excused = "excused"


class ExcuseReason(str, enum.Enum):
    sick = "sick"
    travel = "travel"
    menstruation = "menstruation"
    other = "other"


class CheckinSource(str, enum.Enum):
    app = "app"
    notification = "notification"
    widget = "widget"
    web = "web"
    auto = "auto"


class TaskTemplate(TimestampMixin, Base):
    """Admin boshqaradigan tayyor vazifalar katalogi."""

    __tablename__ = "task_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(48), unique=True)
    category: Mapped[Category] = mapped_column(pg_enum(Category, "category"))
    title: Mapped[dict] = mapped_column(JSONB)
    description: Mapped[dict] = mapped_column(JSONB, default=dict)
    icon: Mapped[str] = mapped_column(String(32))
    color: Mapped[str | None] = mapped_column(String(16))
    prayer_name: Mapped[PrayerName | None] = mapped_column(pg_enum(PrayerName, "prayer_name"))
    default_time: Mapped[time | None] = mapped_column(Time)
    default_duration_min: Mapped[int | None] = mapped_column(SmallInteger)
    default_target: Mapped[float | None] = mapped_column(Numeric(10, 2))
    unit: Mapped[dict | None] = mapped_column(JSONB)
    min_version: Mapped[dict | None] = mapped_column(JSONB)
    suitable_for: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ScheduleMode(TimestampMixin, Base):
    """Rejimlar: ish kuni, dam olish, imtihon, Ramazon…"""

    __tablename__ = "schedule_modes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(60))
    type: Mapped[ModeType] = mapped_column(pg_enum(ModeType, "mode_type"), default=ModeType.custom)
    days_of_week: Mapped[int] = mapped_column(SmallInteger, default=ALL_DAYS)
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def applies_on(self, d: date) -> bool:
        if not self.is_active or not self.days_of_week & day_bit(d):
            return False
        if self.starts_on and d < self.starts_on:
            return False
        if self.ends_on and d > self.ends_on:
            return False
        return True


class RoutineItem(TimestampMixin, Base):
    __tablename__ = "routine_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    # NULL = har qanday rejimda
    mode_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("schedule_modes.id", ondelete="SET NULL")
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("task_templates.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(120))
    category: Mapped[Category] = mapped_column(pg_enum(Category, "category"))
    icon: Mapped[str] = mapped_column(String(32), default="sparkle")
    color: Mapped[str | None] = mapped_column(String(16))
    start_time: Mapped[time | None] = mapped_column(Time)
    duration_min: Mapped[int | None] = mapped_column(SmallInteger)
    days_of_week: Mapped[int] = mapped_column(SmallInteger, default=ALL_DAYS)

    prayer_name: Mapped[PrayerName | None] = mapped_column(pg_enum(PrayerName, "prayer_name"))
    # Vaqt namoz vaqtidan olinadi (+ offset)
    time_from_prayer: Mapped[bool] = mapped_column(Boolean, default=False)
    prayer_offset_min: Mapped[int] = mapped_column(SmallInteger, default=0)

    target_value: Mapped[float | None] = mapped_column(Numeric(10, 2))
    unit: Mapped[str | None] = mapped_column(String(24))
    min_version_text: Mapped[str | None] = mapped_column(String(120))

    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    reminder_offset_min: Mapped[int] = mapped_column(SmallInteger, default=0)
    alarm_type: Mapped[AlarmType] = mapped_column(
        pg_enum(AlarmType, "alarm_type"), default=AlarmType.notification
    )

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # O'chirilgan vazifa arxivlanadi — statistikasi saqlanib qoladi
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    mode: Mapped[ScheduleMode | None] = relationship(lazy="joined")

    def applies_on(self, d: date) -> bool:
        if not self.is_active or self.archived_at is not None:
            return False
        if not self.days_of_week & day_bit(d):
            return False
        if self.mode is not None and not self.mode.applies_on(d):
            return False
        return True


class Checkin(Base):
    __tablename__ = "checkins"
    __table_args__ = (
        UniqueConstraint("routine_item_id", "date", name="uq_checkins_item_date"),
        Index("ix_checkins_user_date", "user_id", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    routine_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("routine_items.id", ondelete="CASCADE")
    )
    date: Mapped[date] = mapped_column(Date)
    status: Mapped[CheckinStatus] = mapped_column(pg_enum(CheckinStatus, "checkin_status"))
    excuse_reason: Mapped[ExcuseReason | None] = mapped_column(
        pg_enum(ExcuseReason, "excuse_reason")
    )
    value: Mapped[float | None] = mapped_column(Numeric(10, 2))
    note: Mapped[str | None] = mapped_column(Text)
    source: Mapped[CheckinSource] = mapped_column(
        pg_enum(CheckinSource, "checkin_source"), default=CheckinSource.app
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

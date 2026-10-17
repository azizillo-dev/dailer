import uuid
from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import (
    AlarmType,
    Category,
    CheckinStatus,
    ExcuseReason,
    ModeType,
    PrayerName,
)
from app.models.routine import ALL_DAYS

ICONS = {
    "sunrise", "sun", "sun-dim", "sunset", "moon", "alarm", "bed", "book", "book-open",
    "sparkle", "activity", "dumbbell", "droplet", "phone-off", "graduation", "laptop", "code",
    "sigma", "target", "languages", "headphones", "list", "pen", "briefcase", "heart",
    "coffee", "music", "brush", "users", "leaf",
}


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    category: Category
    title: dict
    description: dict
    icon: str
    prayer_name: PrayerName | None
    default_time: time | None
    default_duration_min: int | None
    default_target: float | None
    unit: dict | None
    min_version: dict | None
    suitable_for: list[str]


class ModeIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    type: ModeType = ModeType.custom
    days_of_week: int = Field(default=ALL_DAYS, ge=1, le=ALL_DAYS)
    starts_on: date | None = None
    ends_on: date | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def range_ok(self):
        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValueError("ends_on before starts_on")
        return self


class ModeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    days_of_week: int | None = Field(default=None, ge=1, le=ALL_DAYS)
    starts_on: date | None = None
    ends_on: date | None = None
    is_active: bool | None = None


class ModeOut(ModeIn):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


class _ItemFields(BaseModel):
    mode_id: uuid.UUID | None = None
    template_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=120)
    category: Category
    icon: str = "sparkle"
    color: str | None = Field(default=None, max_length=16)
    start_time: time | None = None
    duration_min: int | None = Field(default=None, ge=0, le=24 * 60)
    days_of_week: int = Field(default=ALL_DAYS, ge=1, le=ALL_DAYS)
    prayer_name: PrayerName | None = None
    time_from_prayer: bool = False
    prayer_offset_min: int = Field(default=0, ge=-120, le=180)
    target_value: float | None = Field(default=None, ge=0, le=100000)
    unit: str | None = Field(default=None, max_length=24)
    min_version_text: str | None = Field(default=None, max_length=120)
    reminder_enabled: bool = True
    reminder_offset_min: int = Field(default=0, ge=0, le=180)
    alarm_type: AlarmType = AlarmType.notification


class ItemIn(_ItemFields):
    # Reja tuzuvchidan kelgan vazifalar shablonni kod bilan ko'rsatadi
    template_code: str | None = Field(default=None, max_length=48)

    @model_validator(mode="after")
    def check(self):
        if self.icon not in ICONS:
            self.icon = "sparkle"
        if self.time_from_prayer and self.prayer_name is None:
            raise ValueError("time_from_prayer requires prayer_name")
        return self


class ItemUpdate(BaseModel):
    """Faqat yuborilgan maydonlar o'zgaradi."""

    mode_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=120)
    category: Category | None = None
    icon: str | None = None
    color: str | None = Field(default=None, max_length=16)
    start_time: time | None = None
    duration_min: int | None = Field(default=None, ge=0, le=24 * 60)
    days_of_week: int | None = Field(default=None, ge=1, le=ALL_DAYS)
    prayer_name: PrayerName | None = None
    time_from_prayer: bool | None = None
    prayer_offset_min: int | None = Field(default=None, ge=-120, le=180)
    target_value: float | None = Field(default=None, ge=0, le=100000)
    unit: str | None = Field(default=None, max_length=24)
    min_version_text: str | None = Field(default=None, max_length=120)
    reminder_enabled: bool | None = None
    reminder_offset_min: int | None = Field(default=None, ge=0, le=180)
    alarm_type: AlarmType | None = None
    is_active: bool | None = None


class ItemOut(_ItemFields):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sort_order: int
    is_active: bool


class BulkIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1, max_length=40)
    # true — mavjud vazifalar arxivlanib, yangisi bilan almashtiriladi (onboarding qayta o'tilsa)
    replace: bool = False


class ReorderIn(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


class PlanItemOut(BaseModel):
    template_code: str | None
    title: str
    category: Category
    icon: str
    start_time: time | None
    duration_min: int | None
    days_of_week: int
    prayer_name: PrayerName | None
    time_from_prayer: bool
    target_value: float | None
    unit: str | None
    min_version_text: str | None
    sort_order: int


class CheckinIn(BaseModel):
    routine_item_id: uuid.UUID
    date: date
    status: CheckinStatus
    excuse_reason: ExcuseReason | None = None
    value: float | None = Field(default=None, ge=0, le=100000)
    note: str | None = Field(default=None, max_length=500)
    client_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def excuse(self):
        if self.status == CheckinStatus.excused and self.excuse_reason is None:
            self.excuse_reason = ExcuseReason.other
        if self.status != CheckinStatus.excused:
            self.excuse_reason = None
        return self


class CheckinOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    routine_item_id: uuid.UUID
    date: date
    status: CheckinStatus
    excuse_reason: ExcuseReason | None
    value: float | None
    note: str | None


class CheckinBatchIn(BaseModel):
    checkins: list[CheckinIn] = Field(min_length=1, max_length=200)


class DayItemOut(BaseModel):
    item: ItemOut
    time: time | None
    checkin: CheckinOut | None


class DaySummary(BaseModel):
    planned: int
    done: int
    partial: int
    missed: int
    excused: int
    score: float | None


class RamadanDay(BaseModel):
    day: int | None
    suhoor_ends: time | None
    iftar: time | None


class DayOut(BaseModel):
    date: date
    ramadan: RamadanDay | None = None
    prayer_times: dict[str, time]
    items: list[DayItemOut]
    summary: DaySummary

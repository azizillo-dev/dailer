import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import Gender, Language, Theme, UserRole, UserType
from app.models.user import GoalReminderFreq, Madhab, Privacy

INTERESTS = {
    "reading", "sport", "language", "quran", "study", "programming",
    "math", "sleep", "health", "prayer", "dhikr", "work",
}


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    username: str | None
    avatar_url: str | None
    user_type: UserType | None
    user_type_other: str | None
    birth_year: int | None
    gender: Gender
    language: Language
    theme: Theme
    timezone: str
    city: str | None
    latitude: float | None
    longitude: float | None
    prays: bool
    prayer_method: str
    madhab: Madhab
    prayer_offsets: dict
    wake_time: time | None
    sleep_time: time | None
    evening_summary_time: time | None
    main_goal: str | None
    goal_reminder_freq: GoalReminderFreq
    share_goal_with_ai: bool
    interests: list[str]
    privacy: Privacy
    xp: int
    level: int
    onboarding_completed_at: datetime | None


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool
    role: UserRole
    has_password: bool
    has_google: bool
    has_2fa: bool
    created_at: datetime
    profile: ProfileOut


class ProfileUpdateIn(BaseModel):
    """Barcha maydonlar ixtiyoriy — faqat yuborilganlari o'zgaradi."""

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    user_type: UserType | None = None
    user_type_other: str | None = Field(default=None, max_length=80)
    birth_year: int | None = Field(default=None, ge=1920, le=2025)
    gender: Gender | None = None
    language: Language | None = None
    theme: Theme | None = None
    timezone: str | None = Field(default=None, max_length=64)
    city: str | None = Field(default=None, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    prays: bool | None = None
    prayer_method: str | None = Field(default=None, max_length=32)
    madhab: Madhab | None = None
    prayer_offsets: dict[str, int] | None = None
    wake_time: time | None = None
    sleep_time: time | None = None
    evening_summary_time: time | None = None
    main_goal: str | None = Field(default=None, max_length=1000)
    goal_reminder_freq: GoalReminderFreq | None = None
    share_goal_with_ai: bool | None = None
    interests: list[str] | None = None
    privacy: Privacy | None = None

    @field_validator("interests")
    @classmethod
    def known_interests(cls, v: list[str] | None):
        if v is None:
            return v
        return [i for i in dict.fromkeys(v) if i in INTERESTS]

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, v: str | None):
        if v is None:
            return v
        from zoneinfo import available_timezones

        if v not in available_timezones():
            raise ValueError("unknown timezone")
        return v

    @field_validator("prayer_offsets")
    @classmethod
    def valid_offsets(cls, v: dict[str, int] | None):
        if v is None:
            return v
        allowed = {"fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"}
        return {k: max(-30, min(30, n)) for k, n in v.items() if k in allowed}


class OnboardingIn(ProfileUpdateIn):
    """Onboarding oxirida yuboriladi; asosiy savollar majburiy."""

    user_type: UserType
    birth_year: int = Field(ge=1920, le=2025)
    wake_time: time
    sleep_time: time
    prays: bool
    main_goal: str = Field(min_length=3, max_length=1000)

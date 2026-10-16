import enum
import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, new_id


def pg_enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class UserRole(str, enum.Enum):
    user = "user"
    moderator = "moderator"
    admin = "admin"
    super_admin = "super_admin"


class UserStatus(str, enum.Enum):
    active = "active"
    blocked = "blocked"
    pending_deletion = "pending_deletion"


class UserType(str, enum.Enum):
    university_student = "university_student"
    school_pupil = "school_pupil"
    worker = "worker"
    freelancer = "freelancer"
    entrepreneur = "entrepreneur"
    other = "other"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    unspecified = "unspecified"


class Language(str, enum.Enum):
    uz = "uz"
    ru = "ru"
    en = "en"


class Theme(str, enum.Enum):
    system = "system"
    light = "light"
    dark = "dark"


class Madhab(str, enum.Enum):
    hanafi = "hanafi"
    shafi = "shafi"


class GoalReminderFreq(str, enum.Enum):
    daily = "daily"
    every_3_days = "every_3_days"
    weekly = "weekly"
    off = "off"


class Privacy(str, enum.Enum):
    public = "public"
    friends = "friends"
    private = "private"


class EmailTokenPurpose(str, enum.Enum):
    verify_email = "verify_email"
    reset_password = "reset_password"


class Platform(str, enum.Enum):
    ios = "ios"
    android = "android"
    web = "web"


ADMIN_ROLES = (UserRole.admin, UserRole.super_admin)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    # Doim kichik harfda saqlanadi
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.user)
    status: Mapped[UserStatus] = mapped_column(
        pg_enum(UserStatus, "user_status"), default=UserStatus.active
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deletion_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profile: Mapped["Profile"] = relationship(
        back_populates="user", uselist=False, lazy="joined", cascade="all, delete-orphan"
    )
    two_factor: Mapped["User2FA | None"] = relationship(
        back_populates="user", uselist=False, lazy="joined", cascade="all, delete-orphan"
    )

    @property
    def is_admin(self) -> bool:
        return self.role in ADMIN_ROLES

    @property
    def has_2fa(self) -> bool:
        return self.two_factor is not None and self.two_factor.enabled_at is not None


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[str] = mapped_column(String(120), default="")
    username: Mapped[str | None] = mapped_column(String(32), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    user_type: Mapped[UserType | None] = mapped_column(pg_enum(UserType, "user_type"))
    user_type_other: Mapped[str | None] = mapped_column(String(80))
    birth_year: Mapped[int | None] = mapped_column(SmallInteger)
    gender: Mapped[Gender] = mapped_column(pg_enum(Gender, "gender"), default=Gender.unspecified)
    language: Mapped[Language] = mapped_column(pg_enum(Language, "language"), default=Language.uz)
    theme: Mapped[Theme] = mapped_column(pg_enum(Theme, "theme"), default=Theme.system)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Tashkent")
    city: Mapped[str | None] = mapped_column(String(120))
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6))

    prays: Mapped[bool] = mapped_column(Boolean, default=False)
    prayer_method: Mapped[str] = mapped_column(String(32), default="muslim_world_league")
    madhab: Mapped[Madhab] = mapped_column(pg_enum(Madhab, "madhab"), default=Madhab.hanafi)
    prayer_offsets: Mapped[dict] = mapped_column(JSONB, default=dict)

    wake_time: Mapped[time | None] = mapped_column(Time)
    sleep_time: Mapped[time | None] = mapped_column(Time)
    evening_summary_time: Mapped[time | None] = mapped_column(Time)

    # "Eng oliy maqsadingiz?"
    main_goal: Mapped[str | None] = mapped_column(Text)
    goal_reminder_freq: Mapped[GoalReminderFreq] = mapped_column(
        pg_enum(GoalReminderFreq, "goal_reminder_freq"), default=GoalReminderFreq.daily
    )
    share_goal_with_ai: Mapped[bool] = mapped_column(Boolean, default=True)
    interests: Mapped[list[str]] = mapped_column(ARRAY(String(32)), default=list)
    privacy: Mapped[Privacy] = mapped_column(pg_enum(Privacy, "privacy"), default=Privacy.private)

    xp: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[int] = mapped_column(SmallInteger, default=1)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="profile")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # Bitta login'dan boshlangan rotation zanjiri — o'g'irlangan token qayta ishlatilsa,
    # butun zanjir bekor qilinadi
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class EmailToken(Base):
    __tablename__ = "email_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[EmailTokenPurpose] = mapped_column(
        pg_enum(EmailTokenPurpose, "email_token_purpose")
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User2FA(TimestampMixin, Base):
    __tablename__ = "user_2fa"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    totp_secret_encrypted: Mapped[str] = mapped_column(Text)
    # NULL = sozlash boshlangan, lekin birinchi kod hali tasdiqlanmagan
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    backup_codes_hash: Mapped[list[str]] = mapped_column(ARRAY(String(64)), default=list)

    user: Mapped[User] = relationship(back_populates="two_factor")


class Device(TimestampMixin, Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    platform: Mapped[Platform] = mapped_column(pg_enum(Platform, "platform"))
    push_token: Mapped[str] = mapped_column(Text, unique=True)
    app_version: Mapped[str | None] = mapped_column(String(32))
    locale: Mapped[str | None] = mapped_column(String(16))
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

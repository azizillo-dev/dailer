import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import BannerEventType, BannerKind, BannerPlacement, MotivationCategory


def _i18n(v: dict | None, required: bool) -> dict:
    v = {k: (s or "").strip() for k, s in (v or {}).items() if k in ("uz", "ru", "en")}
    v = {k: s for k, s in v.items() if s}
    if required and not v.get("uz"):
        raise ValueError("uz text is required")
    return v


class MotivationIn(BaseModel):
    text: dict[str, str]
    author: str | None = Field(default=None, max_length=120)
    category: MotivationCategory = MotivationCategory.general
    image_url: str | None = Field(default=None, max_length=1000)
    is_active: bool = True
    publish_on: date | None = None

    @field_validator("text")
    @classmethod
    def check_text(cls, v):
        v = _i18n(v, required=True)
        if any(len(s) > 600 for s in v.values()):
            raise ValueError("too long")
        return v


class MotivationUpdate(BaseModel):
    text: dict[str, str] | None = None
    author: str | None = Field(default=None, max_length=120)
    category: MotivationCategory | None = None
    image_url: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None
    publish_on: date | None = None

    @field_validator("text")
    @classmethod
    def check_text(cls, v):
        return None if v is None else _i18n(v, required=True)


class MotivationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    text: dict
    author: str | None
    category: MotivationCategory
    image_url: str | None
    is_active: bool
    publish_on: date | None
    created_at: datetime


class Audience(BaseModel):
    languages: list[str] = []
    user_types: list[str] = []
    platforms: list[str] = []


class BannerIn(BaseModel):
    kind: BannerKind = BannerKind.news
    title: dict[str, str]
    subtitle: dict[str, str] = {}
    cta: dict[str, str] = {}
    image_mobile_url: str | None = Field(default=None, max_length=1000)
    image_desktop_url: str | None = Field(default=None, max_length=1000)
    link_url: str | None = Field(default=None, max_length=1000)
    placement: BannerPlacement = BannerPlacement.home_top
    audience: Audience = Audience()
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    priority: int = Field(default=0, ge=-100, le=100)
    is_active: bool = True

    @field_validator("title")
    @classmethod
    def check_title(cls, v):
        return _i18n(v, required=True)

    @field_validator("subtitle", "cta")
    @classmethod
    def check_optional(cls, v):
        return _i18n(v, required=False)

    @field_validator("link_url")
    @classmethod
    def safe_link(cls, v):
        if v and not (v.startswith("https://") or v.startswith("http://") or v.startswith("/")):
            raise ValueError("link must be http(s) or an internal path")
        return v

    @model_validator(mode="after")
    def dates(self):
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class BannerUpdate(BannerIn):
    title: dict[str, str] | None = None  # type: ignore[assignment]

    @field_validator("title")
    @classmethod
    def check_title(cls, v):
        return None if v is None else _i18n(v, required=True)


class BannerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: BannerKind
    title: dict
    subtitle: dict
    cta: dict
    image_mobile_url: str | None
    image_desktop_url: str | None
    link_url: str | None
    placement: BannerPlacement
    audience: dict
    starts_at: datetime | None
    ends_at: datetime | None
    priority: int
    is_active: bool
    created_at: datetime


class BannerEventIn(BaseModel):
    banner_id: uuid.UUID
    event: BannerEventType


class BannerEventsIn(BaseModel):
    events: list[BannerEventIn] = Field(min_length=1, max_length=50)
    platform: str | None = Field(default="web", max_length=16)

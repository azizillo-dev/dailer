import uuid
from datetime import datetime

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.api.deps import DB, CurrentUser
from app.core.security import now
from app.models import (
    Banner,
    BannerEvent,
    BannerPlacement,
    Motivation,
    MotivationCategory,
)
from app.schemas.auth import MessageOut
from app.schemas.content import BannerEventsIn, BannerOut, MotivationOut
from app.services.schedule import local_today

router = APIRouter(tags=["content"])


@router.get("/motivations/today", response_model=MotivationOut | None)
async def motivation_of_the_day(db: DB, user: CurrentUser):
    today = local_today(user.profile.timezone)
    pinned = await db.scalar(
        select(Motivation).where(Motivation.is_active.is_(True), Motivation.publish_on == today)
    )
    if pinned:
        return pinned
    # Admin sana belgilamagan bo'lsa — kun raqami bo'yicha aylanadi (hamma uchun bir xil)
    ids = (
        await db.scalars(
            select(Motivation.id)
            .where(Motivation.is_active.is_(True), Motivation.publish_on.is_(None))
            .order_by(Motivation.created_at, Motivation.id)
        )
    ).all()
    if not ids:
        return None
    return await db.get(Motivation, ids[today.toordinal() % len(ids)])


@router.get("/motivations", response_model=list[MotivationOut])
async def list_motivations(
    db: DB,
    user: CurrentUser,
    category: MotivationCategory | None = None,
    before: datetime | None = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    q = select(Motivation).where(
        Motivation.is_active.is_(True),
        or_(Motivation.publish_on.is_(None), Motivation.publish_on <= local_today(user.profile.timezone)),
    )
    if category:
        q = q.where(Motivation.category == category)
    if before:
        q = q.where(Motivation.created_at < before)
    return (await db.scalars(q.order_by(Motivation.created_at.desc()).limit(limit))).all()


def _matches(banner: Banner, lang: str, user_type: str | None, platform: str | None) -> bool:
    a = banner.audience or {}
    if a.get("languages") and lang not in a["languages"]:
        return False
    if a.get("user_types") and user_type not in a["user_types"]:
        return False
    if a.get("platforms") and platform not in a["platforms"]:
        return False
    return True


@router.get("/banners", response_model=list[BannerOut])
async def active_banners(
    db: DB,
    user: CurrentUser,
    placement: BannerPlacement = BannerPlacement.home_top,
    platform: str | None = Query(default="web", max_length=16),
):
    stamp = now()
    rows = await db.scalars(
        select(Banner)
        .where(
            Banner.is_active.is_(True),
            Banner.placement == placement,
            or_(Banner.starts_at.is_(None), Banner.starts_at <= stamp),
            or_(Banner.ends_at.is_(None), Banner.ends_at > stamp),
        )
        .order_by(Banner.priority.desc(), Banner.created_at.desc())
        .limit(20)
    )
    lang = user.profile.language.value
    user_type = user.profile.user_type.value if user.profile.user_type else None
    return [b for b in rows if _matches(b, lang, user_type, platform)][:8]


@router.post("/banners/events", response_model=MessageOut)
async def banner_events(body: BannerEventsIn, db: DB, user: CurrentUser):
    ids = {e.banner_id for e in body.events}
    known: set[uuid.UUID] = set((await db.scalars(select(Banner.id).where(Banner.id.in_(ids)))).all())
    for e in body.events:
        if e.banner_id in known:
            db.add(BannerEvent(banner_id=e.banner_id, user_id=user.id, event=e.event, platform=body.platform))
    await db.commit()
    return MessageOut()

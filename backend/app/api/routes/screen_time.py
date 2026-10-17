from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.models import ScreenTimeDay
from app.services import screen_time as svc
from app.services.schedule import local_today

router = APIRouter(prefix="/screen-time", tags=["screen-time"])

# Android bir martada 2 oygacha tarixni yuborishi mumkin
BACKFILL_DAYS = 62


class AppIn(BaseModel):
    id: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=80)
    minutes: int = Field(ge=0, le=24 * 60)


class DayIn(BaseModel):
    date: date
    total_min: int = Field(ge=0, le=24 * 60)
    pickups: int | None = Field(default=None, ge=0, le=5000)
    apps: list[AppIn] = Field(default_factory=list, max_length=20)


class DaysIn(BaseModel):
    source: Literal["android", "manual"] = "manual"
    days: list[DayIn] = Field(min_length=1, max_length=BACKFILL_DAYS + 1)


class LimitIn(BaseModel):
    limit_min: int | None = Field(default=None, ge=15, le=24 * 60)


@router.get("")
async def get_summary(
    db: DB,
    user: CurrentUser,
    period: Literal["week", "month"] = "week",
    offset: int = Query(default=0, ge=-24, le=0),
):
    return await svc.summary(db, user, period, offset)


@router.put("/days")
async def put_days(body: DaysIn, db: DB, user: CurrentUser):
    """Kunlarni yozish (upsert). Android sinxronlashi qo'lda kiritilganni ham yangilaydi."""
    today = local_today(user.profile.timezone)
    dates = [d.date for d in body.days]
    if len(set(dates)) != len(dates) or any(d > today or d < today - timedelta(days=BACKFILL_DAYS) for d in dates):
        raise AppError("validation_error", 422)
    existing = {
        r.date: r
        for r in await db.scalars(select(ScreenTimeDay).where(ScreenTimeDay.user_id == user.id, ScreenTimeDay.date.in_(dates)))
    }
    for d in body.days:
        r = existing.get(d.date)
        if r is None:
            r = ScreenTimeDay(user_id=user.id, date=d.date)
            db.add(r)
        r.total_min = d.total_min
        r.pickups = d.pickups
        # Qo'lda kiritilganda ilovalar ro'yxati yo'q — avvalgi (Android'dan kelgan) ro'yxat saqlanib qoladi
        if body.source == "android" or d.apps:
            r.apps = sorted((a.model_dump() for a in d.apps), key=lambda a: -a["minutes"])[:12]
        r.source = body.source
    await db.commit()
    return {"saved": len(body.days)}


@router.delete("/days/{day}", status_code=204)
async def delete_day(day: date, db: DB, user: CurrentUser):
    await db.execute(delete(ScreenTimeDay).where(ScreenTimeDay.user_id == user.id, ScreenTimeDay.date == day))
    await db.commit()


@router.put("/limit")
async def put_limit(body: LimitIn, db: DB, user: CurrentUser):
    user.profile.screen_limit_min = body.limit_min
    await db.commit()
    return {"limit_min": body.limit_min}

from datetime import date, time, timedelta

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.models import DayReflection, StreakFreeze
from app.services import insights
from app.services import stats as st
from app.services.schedule import local_today

router = APIRouter(tags=["journal"])

BACKFILL_DAYS = 7
FREEZES_PER_MONTH = 2


class ReflectionIn(BaseModel):
    mood: int | None = Field(default=None, ge=1, le=5)
    energy: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, max_length=500)
    slept_at: time | None = None
    woke_at: time | None = None


def _out(r: DayReflection | None, d: date) -> dict:
    return {
        "date": d,
        "mood": r.mood if r else None,
        "energy": r.energy if r else None,
        "note": r.note if r else None,
        "slept_at": r.slept_at if r else None,
        "woke_at": r.woke_at if r else None,
        "filled": r is not None,
    }


@router.get("/journal/{day}")
async def get_reflection(day: date, db: DB, user: CurrentUser):
    r = await db.scalar(select(DayReflection).where(DayReflection.user_id == user.id, DayReflection.date == day))
    return _out(r, day)


@router.put("/journal/{day}")
async def put_reflection(day: date, body: ReflectionIn, db: DB, user: CurrentUser):
    today = local_today(user.profile.timezone)
    if day > today or day < today - timedelta(days=BACKFILL_DAYS):
        raise AppError("validation_error", 422)
    r = await db.scalar(select(DayReflection).where(DayReflection.user_id == user.id, DayReflection.date == day))
    if r is None:
        r = DayReflection(user_id=user.id, date=day)
        db.add(r)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v.strip() if isinstance(v, str) else v)
    await db.commit()
    return _out(r, day)


async def _used_this_month(db: DB, user_id, today: date) -> list[date]:
    first = today.replace(day=1)
    return list(
        (
            await db.scalars(
                select(StreakFreeze.date)
                .where(StreakFreeze.user_id == user_id, StreakFreeze.date >= first)
                .order_by(StreakFreeze.date)
            )
        ).all()
    )


@router.get("/streak/freezes")
async def freezes(db: DB, user: CurrentUser):
    today = local_today(user.profile.timezone)
    used = await _used_this_month(db, user.id, today)
    return {"allowed": FREEZES_PER_MONTH, "used": len(used), "left": max(0, FREEZES_PER_MONTH - len(used)), "dates": used}


class FreezeIn(BaseModel):
    date: date


@router.post("/streak/freezes", status_code=201)
async def use_freeze(body: FreezeIn, db: DB, user: CurrentUser):
    """O'tgan, "hisoblanmagan" kunni muzlatish — zanjir uzilmaydi."""
    today = local_today(user.profile.timezone)
    if body.date >= today or body.date < today - timedelta(days=BACKFILL_DAYS):
        raise AppError("validation_error", 422)
    used = await _used_this_month(db, user.id, today)
    if len(used) >= FREEZES_PER_MONTH or body.date in used:
        raise AppError("validation_error", 422)
    ctx = await st.load_context(db, user, body.date, today)
    day = ctx.day(body.date).total
    if day.score is not None and day.score >= st.STREAK_THRESHOLD:
        raise AppError("validation_error", 422)  # bu kun uzilmagan — muzlatish shart emas
    db.add(StreakFreeze(user_id=user.id, date=body.date))
    await db.commit()
    ctx = await st.load_context(db, user, today - timedelta(days=st.STREAK_LOOKBACK_DAYS), today)
    return {"streak": st.streak(ctx), "left": FREEZES_PER_MONTH - len(used) - 1}


@router.get("/stats/heatmap")
async def heatmap(db: DB, user: CurrentUser, year: int | None = Query(default=None, ge=2020, le=2100)):
    today = local_today(user.profile.timezone)
    y = year or today.year
    ctx = await st.load_context(db, user, date(y, 1, 1), today)
    days = insights.heatmap(ctx, y)
    scored = [d["score"] for d in days if d["score"] is not None]
    return {
        "year": y,
        "days": days,
        "active_days": len(scored),
        "avg_score": round(sum(scored) / len(scored), 1) if scored else None,
        "perfect_days": sum(1 for s in scored if s >= 100),
    }


@router.get("/stats/insights")
async def get_insights(db: DB, user: CurrentUser):
    return await insights.compute(db, user)


@router.get("/stats/freeze-candidates")
async def freeze_candidates(db: DB, user: CurrentUser):
    """Muzlatsa bo'ladigan oxirgi kunlar (streak'ni uzgan kunlar)."""
    today = local_today(user.profile.timezone)
    ctx = await st.load_context(db, user, today - timedelta(days=BACKFILL_DAYS), today)
    out = []
    for i in range(1, BACKFILL_DAYS + 1):
        d = today - timedelta(days=i)
        s = ctx.day(d).total
        if d not in ctx.freezes and s.planned and s.score is not None and s.score < st.STREAK_THRESHOLD:
            out.append({"date": d, "score": s.score})
    return out

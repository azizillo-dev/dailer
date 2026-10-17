from datetime import date, timedelta

from fastapi import APIRouter, Query

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.models import Category
from app.services import stats as st
from app.services.schedule import local_today

router = APIRouter(prefix="/stats", tags=["stats"])

MAX_RANGE_DAYS = 92


def _day_row(d: st.DayStats) -> dict:
    return {"date": d.date, **d.total.as_dict()}


@router.get("/weekly")
async def weekly(db: DB, user: CurrentUser, start: date | None = None):
    today = local_today(user.profile.timezone)
    ws = st.week_start(start or today)
    we = ws + timedelta(days=6)
    prev_ws = ws - timedelta(days=7)

    ctx = await st.load_context(db, user, today - timedelta(days=st.STREAK_LOOKBACK_DAYS), today)
    days = ctx.range(ws, we)
    prev_days = ctx.range(prev_ws, ws - timedelta(days=1))
    total, cats = st.summarize(days)
    prev_total, prev_cats = st.summarize(prev_days)

    scored = [d for d in days if d.total.score is not None]
    best = max(scored, key=lambda d: d.total.score, default=None)
    weak = min(scored, key=lambda d: d.total.score, default=None)

    categories = []
    for cat in Category:
        cur = cats.get(cat.value)
        if cur is None or cur.planned == 0:
            continue
        prev = prev_cats.get(cat.value)
        categories.append({
            "category": cat.value,
            **cur.as_dict(),
            "prev_score": prev.score if prev else None,
            "delta": st.delta(cur.score, prev.score if prev else None),
        })
    categories.sort(key=lambda c: -c["planned"])

    return {
        "week_start": ws,
        "week_end": we,
        "is_current": ws <= today <= we,
        "days": [_day_row(d) for d in days],
        "total": total.as_dict(),
        "prev_score": prev_total.score,
        "delta": st.delta(total.score, prev_total.score),
        "categories": categories,
        "best_day": best.date if best else None,
        "weak_day": weak.date if weak and weak is not best else None,
        "streak": st.streak(ctx),
    }


@router.get("/category/{category}")
async def category_stats(
    category: Category,
    db: DB,
    user: CurrentUser,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
):
    today = local_today(user.profile.timezone)
    end = min(date_to or today, today)
    begin = date_from or end - timedelta(days=27)
    if begin > end or (end - begin).days >= MAX_RANGE_DAYS:
        raise AppError("validation_error", 422)

    span = (end - begin).days + 1
    prev_begin = begin - timedelta(days=span)
    ctx = await st.load_context(db, user, prev_begin, today)

    days = [ctx.day(begin + timedelta(days=i), category.value) for i in range(span)]
    prev = [ctx.day(prev_begin + timedelta(days=i), category.value) for i in range(span)]
    total, _ = st.summarize(days)
    prev_total, _ = st.summarize(prev)

    # Har bir vazifa bo'yicha — qaysi biri ko'proq o'tkazib yuborilmoqda
    per_item = []
    for item in ctx.items:
        if item.category != category:
            continue
        tally = st.Tally()
        for d in days:
            if ctx.alive_on(item, d.date) and d.date <= today:
                c = ctx.checkins.get((item.id, d.date))
                tally.planned += 1
                if c is None:
                    if d.date < today:
                        tally.missed += 1
                    else:
                        tally.open += 1
                else:
                    setattr(tally, c.status.value, getattr(tally, c.status.value) + 1)
        if tally.planned:
            per_item.append({"item_id": item.id, "title": item.title, "icon": item.icon, **tally.as_dict()})
    per_item.sort(key=lambda x: (x["score"] is None, x["score"] or 0))

    return {
        "category": category.value,
        "from": begin,
        "to": end,
        "days": [_day_row(d) for d in days],
        "total": total.as_dict(),
        "prev_score": prev_total.score,
        "delta": st.delta(total.score, prev_total.score),
        "items": per_item,
    }


@router.get("/streak")
async def streak(db: DB, user: CurrentUser):
    today = local_today(user.profile.timezone)
    ctx = await st.load_context(db, user, today - timedelta(days=st.STREAK_LOOKBACK_DAYS), today)
    return st.streak(ctx)

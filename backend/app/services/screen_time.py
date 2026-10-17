"""Telefon ekran vaqti: hafta/oy xulosasi va kun bali bilan bog'liqlik."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ScreenTimeDay, User
from app.services import stats as st
from app.services.schedule import local_today

INSIGHT_LOOKBACK = 30
INSIGHT_MIN_DAYS = 8


def period_range(period: str, offset: int, today: date) -> tuple[date, date]:
    """period='week' — dushanbadan yakshanbagacha, 'month' — kalendar oyi; offset=-1 — oldingisi."""
    if period == "week":
        start = st.week_start(today) + timedelta(weeks=offset)
        return start, start + timedelta(days=6)
    y, m = today.year, today.month + offset
    while m < 1:
        y, m = y - 1, m + 12
    while m > 12:
        y, m = y + 1, m - 12
    start = date(y, m, 1)
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return start, nxt - timedelta(days=1)


async def _rows(db: AsyncSession, user_id, start: date, end: date) -> dict[date, ScreenTimeDay]:
    rows = await db.scalars(
        select(ScreenTimeDay).where(ScreenTimeDay.user_id == user_id, ScreenTimeDay.date >= start, ScreenTimeDay.date <= end)
    )
    return {r.date: r for r in rows}


def _avg(values: list[int]) -> int | None:
    return round(sum(values) / len(values)) if values else None


def _top_apps(rows, limit: int = 8) -> list[dict]:
    mins: dict[str, int] = defaultdict(int)
    names: dict[str, str] = {}
    for r in rows:
        for a in r.apps or []:
            key = str(a.get("id") or a.get("name") or "")
            if not key:
                continue
            mins[key] += int(a.get("minutes") or 0)
            names[key] = str(a.get("name") or key)
    top = sorted(mins.items(), key=lambda kv: -kv[1])[:limit]
    return [{"id": k, "name": names[k], "minutes": v} for k, v in top if v > 0]


async def summary(db: AsyncSession, user: User, period: str = "week", offset: int = 0) -> dict:
    today = local_today(user.profile.timezone)
    start, end = period_range(period, offset, today)
    p_start, p_end = period_range(period, offset - 1, today)
    cur = await _rows(db, user.id, start, end)
    prev = await _rows(db, user.id, p_start, p_end)

    days = []
    for i in range((end - start).days + 1):
        d = start + timedelta(days=i)
        r = cur.get(d)
        days.append({
            "date": d,
            "total_min": r.total_min if r else None,
            "pickups": r.pickups if r else None,
            "source": r.source if r else None,
            "future": d > today,
        })

    totals = [r.total_min for r in cur.values()]
    avg = _avg(totals)
    prev_avg = _avg([r.total_min for r in prev.values()])
    limit = user.profile.screen_limit_min
    with_data = [x for x in days if x["total_min"] is not None]
    return {
        "period": period,
        "start": start,
        "end": end,
        "days": days,
        "total_min": sum(totals),
        "avg_min": avg,
        "prev_avg_min": prev_avg,
        # Manfiy — kamaygan (yaxshi)
        "delta_pct": round((avg - prev_avg) / prev_avg * 100) if avg is not None and prev_avg else None,
        "avg_pickups": _avg([r.pickups for r in cur.values() if r.pickups is not None]),
        "top_apps": _top_apps(cur.values()),
        "limit_min": limit,
        "days_over_limit": sum(1 for x in with_data if limit and x["total_min"] > limit),
        "best_day": min(with_data, key=lambda x: x["total_min"])["date"] if with_data else None,
        "worst_day": max(with_data, key=lambda x: x["total_min"])["date"] if len(with_data) > 1 else None,
        "insight": await correlation(db, user, today),
    }


async def correlation(db: AsyncSession, user: User, today: date) -> dict | None:
    """Ekran vaqti kam kunlarda kun bali qanchalik yuqori — oxirgi 30 kun, median bo'yicha ikkiga bo'linadi."""
    start = today - timedelta(days=INSIGHT_LOOKBACK)
    rows = await _rows(db, user.id, start, today - timedelta(days=1))
    if len(rows) < INSIGHT_MIN_DAYS:
        return None
    ctx = await st.load_context(db, user, start, today)
    pairs = [(r.total_min, ctx.day(d).total.score) for d, r in rows.items()]
    pairs = [(m, s) for m, s in pairs if s is not None]
    if len(pairs) < INSIGHT_MIN_DAYS:
        return None
    pairs.sort()
    half = len(pairs) // 2
    low, high = pairs[:half], pairs[-half:]
    low_score = sum(s for _, s in low) / len(low)
    high_score = sum(s for _, s in high) / len(high)
    diff = round(low_score - high_score)
    if diff < 5:
        return None
    return {
        "threshold_min": low[-1][0],
        "low_score": round(low_score),
        "high_score": round(high_score),
        "diff": diff,
    }


async def ai_digest(db: AsyncSession, user: User) -> dict | None:
    """AI konteksti uchun: oxirgi 7 kun o'rtacha va oldingi 7 kun bilan solishtirish."""
    today = local_today(user.profile.timezone)
    cur = await _rows(db, user.id, today - timedelta(days=7), today - timedelta(days=1))
    if not cur:
        return None
    prev = await _rows(db, user.id, today - timedelta(days=14), today - timedelta(days=8))
    return {
        "avg_min_per_day": _avg([r.total_min for r in cur.values()]),
        "prev_avg_min_per_day": _avg([r.total_min for r in prev.values()]),
        "top_apps": [a["name"] for a in _top_apps(cur.values(), 3)],
        "limit_min": user.profile.screen_limit_min,
    }

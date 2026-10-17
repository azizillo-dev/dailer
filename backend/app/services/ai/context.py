"""AI uchun qisqa, ANONIM kontekst: ism, email, ID yuborilmaydi."""

from collections import Counter
from datetime import date, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckinStatus, FocusKind, PomodoroSession, User
from app.services import stats as st
from app.services.schedule import build_day, local_today

WEEKDAYS = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"]


def _window(ctx: st.StatsContext, end: date, days: int) -> tuple[st.Tally, dict[str, st.Tally], list[st.DayStats]]:
    rows = ctx.range(end - timedelta(days=days - 1), end)
    total, cats = st.summarize(rows)
    return total, cats, rows


async def build_context(db: AsyncSession, user: User) -> dict:
    p = user.profile
    today = local_today(p.timezone)
    ctx = await st.load_context(db, user, today - timedelta(days=st.STREAK_LOOKBACK_DAYS), today)

    cur, cur_cats, cur_days = _window(ctx, today, 7)
    prev, prev_cats, _ = _window(ctx, today - timedelta(days=7), 7)

    # Eng ko'p o'tkazib yuborilgan vazifalar (oxirgi 7 kun, bugun hisobga olinmaydi)
    missed: Counter = Counter()
    for d in (today - timedelta(days=i) for i in range(1, 8)):
        for item in ctx.items:
            if not ctx.alive_on(item, d):
                continue
            c = ctx.checkins.get((item.id, d))
            if c is None or c.status == CheckinStatus.missed:
                missed[item.id] += 1
    by_id = {i.id: i for i in ctx.items}
    most_missed = [
        {
            "title": by_id[i].title,
            "category": by_id[i].category.value,
            "missed_days": n,
            "usual_time": by_id[i].start_time.strftime("%H:%M") if by_id[i].start_time else None,
        }
        for i, n in missed.most_common(3)
        if n >= 2
    ]

    scored = [d for d in cur_days if d.total.score is not None]
    best = max(scored, key=lambda d: d.total.score, default=None)
    weak = min(scored, key=lambda d: d.total.score, default=None)

    day = await build_day(db, user, today)
    nxt = next(
        (e for e in day["items"] if e["checkin"] is None and e["time"] and e["time"] >= _now_time(p.timezone)),
        None,
    )

    focus_min = await db.scalar(
        select(func.coalesce(func.sum(PomodoroSession.actual_min), 0)).where(
            PomodoroSession.user_id == user.id,
            PomodoroSession.kind == FocusKind.focus,
            PomodoroSession.date >= today - timedelta(days=6),
        )
    )

    age = (today.year - p.birth_year) if p.birth_year else None
    return {
        "user": {
            "type": p.user_type.value if p.user_type else None,
            "age": age,
            "prays": p.prays,
            "interests": p.interests,
            "wake_time": p.wake_time.strftime("%H:%M") if p.wake_time else None,
            "sleep_time": p.sleep_time.strftime("%H:%M") if p.sleep_time else None,
            "main_goal": p.main_goal if p.share_goal_with_ai else None,
        },
        "today": {
            "date": today.isoformat(),
            "weekday": WEEKDAYS[today.weekday()],
            "planned": day["summary"]["planned"],
            "done": day["summary"]["done"],
            "next_task": {"title": nxt["item"].title, "time": nxt["time"].strftime("%H:%M")} if nxt else None,
        },
        "last_7_days": {
            "score": cur.score,
            "prev_7_days_score": prev.score,
            "by_category": {k: v.score for k, v in cur_cats.items() if v.planned},
            "prev_by_category": {k: v.score for k, v in prev_cats.items() if v.planned},
            "done": cur.done,
            "planned": cur.planned,
            "best_day": WEEKDAYS[best.date.weekday()] if best else None,
            "weak_day": WEEKDAYS[weak.date.weekday()] if weak and weak is not best else None,
            "focus_minutes": int(focus_min or 0),
        },
        "streak": st.streak(ctx),
        "most_missed": most_missed,
    }


def _now_time(tz: str) -> time:
    from datetime import datetime
    from zoneinfo import ZoneInfo

    return datetime.now(ZoneInfo(tz)).time()

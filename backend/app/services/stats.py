"""Statistika: kunlik/haftalik ball, kategoriyalar, streak.

Qoidalar:
- Vazifa yaratilgan kundan boshlab va arxivlangan kungacha hisobga olinadi.
- O'tgan kunlarda belgilanmagan vazifa — "o'tkazilgan" hisoblanadi; bugun esa hali ochiq.
- Uzrli vazifalar maxrajdan chiqariladi, qisman bajarilgani — yarim ball.
"""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkin, CheckinStatus, RoutineItem, StreakFreeze, User

# Kun "hisoblangan" bo'lishi uchun minimal ball (streak uchun)
STREAK_THRESHOLD = 50.0
STREAK_LOOKBACK_DAYS = 400


@dataclass
class Tally:
    planned: int = 0
    done: int = 0
    partial: int = 0
    missed: int = 0
    excused: int = 0
    open: int = 0  # bugun hali belgilanmagan

    @property
    def score(self) -> float | None:
        base = self.planned - self.excused - self.open
        if base <= 0:
            return None
        return round((self.done + self.partial * 0.5) / base * 100, 1)

    def add(self, other: "Tally") -> None:
        for k in ("planned", "done", "partial", "missed", "excused", "open"):
            setattr(self, k, getattr(self, k) + getattr(other, k))

    def as_dict(self) -> dict:
        return {
            "planned": self.planned,
            "done": self.done,
            "partial": self.partial,
            "missed": self.missed,
            "excused": self.excused,
            "score": self.score,
        }


@dataclass
class DayStats:
    date: date
    total: Tally = field(default_factory=Tally)
    by_category: dict[str, Tally] = field(default_factory=lambda: defaultdict(Tally))


class StatsContext:
    """Foydalanuvchining barcha vazifalari va kerakli oraliqdagi check-in'lari bir marta yuklanadi."""

    def __init__(
        self,
        user: User,
        items: list[RoutineItem],
        checkins: list[Checkin],
        today: date,
        freezes: set[date] | None = None,
    ):
        self.user = user
        self.items = items
        self.today = today
        self.tz = ZoneInfo(user.profile.timezone)
        self.checkins: dict[tuple[uuid.UUID, date], Checkin] = {
            (c.routine_item_id, c.date): c for c in checkins
        }
        # Muzlatilgan kunlar zanjirni uzmaydi
        self.freezes = freezes or set()

    def alive_on(self, item: RoutineItem, d: date) -> bool:
        created = item.created_at.astimezone(self.tz).date()
        if d < created:
            return False
        if item.archived_at is not None and d >= item.archived_at.astimezone(self.tz).date():
            return False
        if item.archived_at is None and not item.is_active:
            return False
        # Rejim va hafta kunlari — joriy sozlamalar bo'yicha
        if not item.days_of_week & (1 << d.weekday()):
            return False
        if item.mode is not None and not item.mode.applies_on(d):
            return False
        return True

    def day(self, d: date, category: str | None = None) -> DayStats:
        stats = DayStats(d)
        if d > self.today:
            return stats
        for item in self.items:
            if category and item.category.value != category:
                continue
            if not self.alive_on(item, d):
                continue
            t = Tally(planned=1)
            c = self.checkins.get((item.id, d))
            if c is None:
                if d < self.today:
                    t.missed = 1
                else:
                    t.open = 1
            elif c.status == CheckinStatus.done:
                t.done = 1
            elif c.status == CheckinStatus.partial:
                t.partial = 1
            elif c.status == CheckinStatus.missed:
                t.missed = 1
            else:
                t.excused = 1
            stats.total.add(t)
            stats.by_category[item.category.value].add(t)
        return stats

    def range(self, start: date, end: date) -> list[DayStats]:
        return [self.day(start + timedelta(days=i)) for i in range((end - start).days + 1)]


async def load_context(db: AsyncSession, user: User, start: date, today: date) -> StatsContext:
    items = (
        await db.scalars(select(RoutineItem).where(RoutineItem.user_id == user.id))
    ).unique().all()
    checkins = (
        await db.scalars(
            select(Checkin).where(
                Checkin.user_id == user.id, Checkin.date >= start, Checkin.date <= today
            )
        )
    ).all()
    freezes = set(
        (
            await db.scalars(
                select(StreakFreeze.date).where(
                    StreakFreeze.user_id == user.id, StreakFreeze.date >= start, StreakFreeze.date <= today
                )
            )
        ).all()
    )
    return StatsContext(user, list(items), list(checkins), today, freezes)


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def summarize(days: list[DayStats]) -> tuple[Tally, dict[str, Tally]]:
    total = Tally()
    cats: dict[str, Tally] = defaultdict(Tally)
    for d in days:
        total.add(d.total)
        for k, v in d.by_category.items():
            cats[k].add(v)
    return total, cats


def delta(now: float | None, before: float | None) -> float | None:
    if now is None or before is None:
        return None
    return round(now - before, 1)


def streak(ctx: StatsContext) -> dict:
    """Ketma-ket "hisoblangan" kunlar. Bugun hali tugamagani uchun uzilish sanalmaydi."""
    current = 0
    d = ctx.today
    today_stats = ctx.day(d)
    if today_stats.total.score is not None and today_stats.total.score >= STREAK_THRESHOLD:
        current = 1
    d -= timedelta(days=1)
    limit = ctx.today - timedelta(days=STREAK_LOOKBACK_DAYS)
    while d >= limit:
        if d in ctx.freezes:
            d -= timedelta(days=1)
            continue
        s = ctx.day(d).total
        if s.planned == 0 or s.score is None:
            # Vazifasiz yoki to'liq uzrli kun streak'ni uzmaydi, lekin qo'shmaydi ham
            if s.planned == 0 and d < min(
                (i.created_at.astimezone(ctx.tz).date() for i in ctx.items), default=ctx.today
            ):
                break
            d -= timedelta(days=1)
            continue
        if s.score < STREAK_THRESHOLD:
            break
        current += 1
        d -= timedelta(days=1)

    # Eng uzun — oxirgi lookback oralig'ida
    longest = run = 0
    first = min((i.created_at.astimezone(ctx.tz).date() for i in ctx.items), default=ctx.today)
    d = max(first, limit)
    while d <= ctx.today:
        if d in ctx.freezes:
            d += timedelta(days=1)
            continue
        s = ctx.day(d).total
        if s.score is not None:
            if s.score >= STREAK_THRESHOLD:
                run += 1
                longest = max(longest, run)
            elif d < ctx.today:
                run = 0
        d += timedelta(days=1)
    return {"current": current, "longest": max(longest, current), "threshold": STREAK_THRESHOLD}

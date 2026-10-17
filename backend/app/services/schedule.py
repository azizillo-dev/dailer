"""Bir kunlik jadvalni yig'ish: rejimlar, hafta kunlari, namoz vaqtlari va check-in'lar."""

import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Checkin, CheckinStatus, ModeType, RoutineItem, ScheduleMode, User
from app.services import prayer


def local_today(tz: str) -> date:
    return datetime.now(ZoneInfo(tz)).date()


def resolve_time(item: RoutineItem, prayer_times: dict[str, time]) -> time | None:
    if item.time_from_prayer and item.prayer_name is not None:
        base = prayer_times.get(item.prayer_name.value)
        if base is None:
            return item.start_time
        shifted = datetime.combine(date.today(), base) + timedelta(minutes=item.prayer_offset_min)
        return shifted.time()
    return item.start_time


def score(planned: int, done: int, partial: int, excused: int) -> float | None:
    """Uzrli vazifalar maxrajdan chiqariladi; qisman bajarilgan — yarim ball."""
    base = planned - excused
    if base <= 0:
        return None
    return round((done + partial * 0.5) / base * 100, 1)


async def build_day(db: AsyncSession, user: User, d: date) -> dict:
    profile = user.profile
    times = prayer.for_profile(profile, d)

    items = (
        await db.scalars(
            select(RoutineItem).where(
                RoutineItem.user_id == user.id,
                RoutineItem.is_active.is_(True),
                RoutineItem.archived_at.is_(None),
            )
        )
    ).unique().all()
    todays = [i for i in items if i.applies_on(d)]

    checkins: dict[uuid.UUID, Checkin] = {}
    if todays:
        rows = await db.scalars(
            select(Checkin).where(
                Checkin.user_id == user.id,
                Checkin.date == d,
                Checkin.routine_item_id.in_([i.id for i in todays]),
            )
        )
        checkins = {c.routine_item_id: c for c in rows}

    entries = []
    for item in todays:
        resolved = resolve_time(item, times)
        entries.append((resolved, item.sort_order, item, checkins.get(item.id)))
    # Vaqtsiz vazifalar (masalan "suv ichish") oxirida
    entries.sort(key=lambda e: (e[0] is None, e[0] or time(0), e[1]))

    counts = {s: 0 for s in CheckinStatus}
    for *_, c in entries:
        if c is not None:
            counts[c.status] += 1

    ramadan_mode = await db.scalar(
        select(ScheduleMode).where(ScheduleMode.user_id == user.id, ScheduleMode.type == ModeType.ramadan)
    )
    ramadan = None
    if ramadan_mode and ramadan_mode.applies_on(d):
        ramadan = {
            "day": (d - ramadan_mode.starts_on).days + 1 if ramadan_mode.starts_on else None,
            "suhoor_ends": times.get("fajr"),
            "iftar": times.get("maghrib"),
        }

    return {
        "date": d,
        "ramadan": ramadan,
        "prayer_times": times,
        "items": [
            {"item": item, "time": t, "checkin": c} for t, _, item, c in entries
        ],
        "summary": {
            "planned": len(entries),
            "done": counts[CheckinStatus.done],
            "partial": counts[CheckinStatus.partial],
            "missed": counts[CheckinStatus.missed],
            "excused": counts[CheckinStatus.excused],
            "score": score(
                len(entries),
                counts[CheckinStatus.done],
                counts[CheckinStatus.partial],
                counts[CheckinStatus.excused],
            ),
        },
    }

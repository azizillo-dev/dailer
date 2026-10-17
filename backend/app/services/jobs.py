"""Fon vazifalari (worker har daqiqa chaqiradi). Har bir xabar foydalanuvchining mahalliy vaqti bo'yicha
va kuniga bir marta (Redis dedupe) yuboriladi."""

import logging
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckinStatus, NotificationKind, Profile, User, UserStatus
from app.models.user import GoalReminderFreq
from app.services import notify, uploads
from app.services import stats as st
from app.services.schedule import build_day

log = logging.getLogger(__name__)
DELETE_AFTER_DAYS = 30

TEXT = {
    "uz": {
        "summary_title": "Bugungi kun xulosasi",
        "all_done": "Bugun {done}/{total} — hammasi bajarildi! Zo'r kun bo'ldi. Ertaga ham shu ritmda.",
        "summary": "Bugun {done}/{total} bajarildi.",
        "left": " Qolib ketdi: {items}.",
        "still_time": " Hali vaqt bor — bittasini bajarib qo'ying.",
        "streak": " Ketma-ket {n} kunlik zanjiringizni uzmang!",
        "goal_title": "Don't forget why you started!",
        "miss_title": "Ikki marta o'tkazmang",
        "miss": "Kecha og'irroq kun bo'ldi — bu normal. Asosiysi: ikki marta ketma-ket o'tkazmaslik. Bugun bitta kichik qadam yetarli.",
    },
    "ru": {
        "summary_title": "Итоги дня",
        "all_done": "Сегодня {done}/{total} — всё выполнено! Отличный день. Завтра в том же ритме.",
        "summary": "Сегодня выполнено {done}/{total}.",
        "left": " Осталось: {items}.",
        "still_time": " Ещё есть время — сделайте хотя бы одно.",
        "streak": " Не рвите цепочку из {n} дней!",
        "goal_title": "Don't forget why you started!",
        "miss_title": "Не пропускайте дважды",
        "miss": "Вчера был трудный день — это нормально. Главное — не пропускать два раза подряд. Сегодня достаточно одного маленького шага.",
    },
    "en": {
        "summary_title": "Today's summary",
        "all_done": "Today {done}/{total} — everything done! Great day. Same rhythm tomorrow.",
        "summary": "Today {done}/{total} done.",
        "left": " Left: {items}.",
        "still_time": " There's still time — do at least one.",
        "streak": " Don't break your {n}-day streak!",
        "goal_title": "Don't forget why you started!",
        "miss_title": "Never miss twice",
        "miss": "Yesterday was a tougher day — that's normal. The key is never missing twice in a row. One small step today is enough.",
    },
}


def _tx(profile: Profile) -> dict:
    return TEXT.get(profile.language.value, TEXT["uz"])


def _local(now_utc: datetime, tz: str) -> datetime:
    return now_utc.astimezone(ZoneInfo(tz))


def _same_minute(local: datetime, t: time | None, plus_min: int = 0) -> bool:
    if t is None:
        return False
    target = (datetime.combine(local.date(), t) + timedelta(minutes=plus_min)).time()
    return local.hour == target.hour and local.minute == target.minute


async def _active_users(db: AsyncSession) -> list[User]:
    rows = await db.scalars(
        select(User).join(Profile).where(User.status == UserStatus.active, Profile.onboarding_completed_at.is_not(None))
    )
    return list(rows.unique())


async def evening_summaries(db: AsyncSession, now_utc: datetime) -> int:
    count = 0
    for user in await _active_users(db):
        p = user.profile
        local = _local(now_utc, p.timezone)
        if not _same_minute(local, p.evening_summary_time):
            continue
        day = await build_day(db, user, local.date())
        s = day["summary"]
        if s["planned"] == 0:
            continue
        tx = _tx(p)
        left = [e["item"].title for e in day["items"] if e["checkin"] is None or e["checkin"].status == CheckinStatus.missed]
        if not left:
            body = tx["all_done"].format(done=s["done"], total=s["planned"])
        else:
            body = tx["summary"].format(done=s["done"] + s["partial"], total=s["planned"])
            body += tx["left"].format(items=", ".join(left[:3]) + ("…" if len(left) > 3 else ""))
            body += tx["still_time"]
            ctx = await st.load_context(db, user, local.date() - timedelta(days=60), local.date())
            streak = st.streak(ctx)["current"]
            if streak >= 3:
                body += tx["streak"].format(n=streak)
        if await notify.send(
            db, user.id, NotificationKind.evening_summary, tx["summary_title"], body, {"url": "/today?reflect=1"},
            dedupe_key=f"evening:{user.id}:{local.date()}",
        ):
            count += 1
    return count


def _goal_day(freq: GoalReminderFreq, d: date) -> bool:
    if freq == GoalReminderFreq.off:
        return False
    if freq == GoalReminderFreq.weekly:
        return d.weekday() == 0
    if freq == GoalReminderFreq.every_3_days:
        return d.toordinal() % 3 == 0
    return True


async def goal_reminders(db: AsyncSession, now_utc: datetime) -> int:
    count = 0
    for user in await _active_users(db):
        p = user.profile
        if not p.main_goal:
            continue
        local = _local(now_utc, p.timezone)
        if not _goal_day(p.goal_reminder_freq, local.date()) or not _same_minute(local, p.wake_time, 30):
            continue
        if await notify.send(
            db, user.id, NotificationKind.goal_reminder, _tx(p)["goal_title"], p.main_goal, {"url": "/today"},
            dedupe_key=f"goal:{user.id}:{local.date()}",
        ):
            count += 1
    return count


async def never_miss_twice(db: AsyncSession, now_utc: datetime) -> int:
    """Kecha "hisoblanmagan" kun bo'lsa — ertalab yumshoq eslatma."""
    count = 0
    for user in await _active_users(db):
        p = user.profile
        local = _local(now_utc, p.timezone)
        if not _same_minute(local, p.wake_time, 10):
            continue
        yesterday = local.date() - timedelta(days=1)
        ctx = await st.load_context(db, user, yesterday, local.date())
        y = ctx.day(yesterday).total
        if y.planned == 0 or y.score is None or y.score >= st.STREAK_THRESHOLD:
            continue
        tx = _tx(p)
        if await notify.send(
            db, user.id, NotificationKind.never_miss_twice, tx["miss_title"], tx["miss"], {"url": "/today"},
            dedupe_key=f"miss:{user.id}:{local.date()}",
        ):
            count += 1
    return count


async def purge_deleted_accounts(db: AsyncSession, now_utc: datetime) -> int:
    cutoff = now_utc - timedelta(days=DELETE_AFTER_DAYS)
    users = (
        await db.scalars(
            select(User).where(User.status == UserStatus.pending_deletion, User.deletion_requested_at < cutoff)
        )
    ).unique().all()
    for u in users:
        uploads.remove(u.profile.avatar_url if u.profile else None)
    if users:
        await db.execute(delete(User).where(User.id.in_([u.id for u in users])))
        await db.commit()
        log.info("Purged %s accounts", len(users))
    return len(users)


async def minute_tick(db: AsyncSession, now_utc: datetime | None = None) -> dict:
    now_utc = now_utc or datetime.now(UTC)
    return {
        "evening": await evening_summaries(db, now_utc),
        "goal": await goal_reminders(db, now_utc),
        "miss": await never_miss_twice(db, now_utc),
    }

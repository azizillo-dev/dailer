"""Nishonlar va daraja (XP).

Qoidalar statistikadan hisoblanadi; birinchi marta bajarilganda `user_badges` ga yoziladi
va keyin olib qo'yilmaydi (streak uzilsa ham nishon qoladi).
"""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Book,
    BookStatus,
    Category,
    ChallengeParticipant,
    Checkin,
    CheckinStatus,
    FocusKind,
    PomodoroSession,
    PrayerName,
    QuranProgress,
    RoutineItem,
    User,
    UserBadge,
)
from app.services import stats as st
from app.services.schedule import local_today


@dataclass(frozen=True)
class Badge:
    code: str
    icon: str
    xp: int
    title: dict
    text: dict


def _b(code, icon, xp, uz, ru, en, tuz, tru, ten) -> Badge:
    return Badge(code, icon, xp, {"uz": uz, "ru": ru, "en": en}, {"uz": tuz, "ru": tru, "en": ten})


BADGES: list[Badge] = [
    _b("first_step", "sparkle", 10, "Birinchi qadam", "Первый шаг", "First step",
       "Birinchi vazifani bajardingiz", "Выполнили первую задачу", "Completed your first task"),
    _b("perfect_day", "target", 30, "Mukammal kun", "Идеальный день", "Perfect day",
       "Bir kunda hamma vazifa bajarildi", "Все задачи дня выполнены", "Every task done in one day"),
    _b("streak_7", "activity", 50, "7 kun zanjir", "Цепочка 7 дней", "7-day streak",
       "Ketma-ket 7 kun", "7 дней подряд", "7 days in a row"),
    _b("streak_30", "activity", 200, "30 kun zanjir", "Цепочка 30 дней", "30-day streak",
       "Ketma-ket 30 kun — bu endi odat", "30 дней подряд — это уже привычка", "30 days in a row — it's a habit now"),
    _b("streak_100", "activity", 600, "100 kun", "100 дней", "100 days",
       "Ketma-ket 100 kun", "100 дней подряд", "100 days in a row"),
    _b("fajr_30", "sunrise", 150, "Bomdod sohibi", "Хранитель фаджра", "Fajr keeper",
       "30 marta bomdod namozi", "30 раз фаджр", "Fajr prayer 30 times"),
    _b("prayer_100", "moon", 250, "Namozxon", "Намаз 100", "Prayer 100",
       "100 ta namoz belgilandi", "Отмечено 100 намазов", "100 prayers checked"),
    _b("book_1", "book", 60, "Birinchi kitob", "Первая книга", "First book",
       "Bir kitobni oxirigacha o'qidingiz", "Дочитали первую книгу", "Finished your first book"),
    _b("book_5", "book-open", 250, "Kitobxon", "Книголюб", "Bookworm",
       "5 ta kitob o'qildi", "Прочитано 5 книг", "5 books finished"),
    _b("quran_khatm", "book-open", 400, "Xatm", "Хатм", "Khatm",
       "Qur'onni to'liq o'qib chiqdingiz", "Прочитали Коран полностью", "Read the whole Quran"),
    _b("focus_10h", "target", 120, "10 soat fokus", "10 часов фокуса", "10 hours of focus",
       "Pomodoro bilan 10 soat", "10 часов с Pomodoro", "10 hours with Pomodoro"),
    _b("challenge_done", "languages", 150, "Challenge g'olibi", "Победитель челленджа", "Challenge winner",
       "Birinchi challenge tugallandi", "Завершён первый челлендж", "First challenge completed"),
]
BY_CODE = {b.code: b for b in BADGES}
LEVEL_XP = 300  # har daraja uchun


async def _earned_now(db: AsyncSession, user: User) -> set[str]:
    """Hozirgi statistika bo'yicha bajarilgan shartlar."""
    out: set[str] = set()
    uid = user.id
    done = await db.scalar(
        select(func.count()).select_from(Checkin).where(Checkin.user_id == uid, Checkin.status == CheckinStatus.done)
    )
    if done:
        out.add("first_step")

    today = local_today(user.profile.timezone)
    ctx = await st.load_context(db, user, today - timedelta(days=st.STREAK_LOOKBACK_DAYS), today)
    s = st.streak(ctx)
    best = max(s["current"], s["longest"])
    for n in (7, 30, 100):
        if best >= n:
            out.add(f"streak_{n}")
    for d in ctx.range(today - timedelta(days=60), today):
        t = d.total
        if t.planned >= 3 and t.done + t.excused == t.planned and t.done > 0:
            out.add("perfect_day")
            break

    prayers = await db.execute(
        select(RoutineItem.prayer_name, func.count())
        .join(Checkin, Checkin.routine_item_id == RoutineItem.id)
        .where(RoutineItem.user_id == uid, RoutineItem.category == Category.prayer, Checkin.status == CheckinStatus.done)
        .group_by(RoutineItem.prayer_name)
    )
    per = {name: n for name, n in prayers.all()}
    if per.get(PrayerName.fajr, 0) >= 30:
        out.add("fajr_30")
    if sum(per.values()) >= 100:
        out.add("prayer_100")

    books = await db.scalar(
        select(func.count()).select_from(Book).where(Book.user_id == uid, Book.status == BookStatus.finished)
    ) or 0
    if books >= 1:
        out.add("book_1")
    if books >= 5:
        out.add("book_5")

    q = await db.get(QuranProgress, uid)
    if q and q.khatm_count >= 1:
        out.add("quran_khatm")

    focus = await db.scalar(
        select(func.coalesce(func.sum(PomodoroSession.actual_min), 0)).where(
            PomodoroSession.user_id == uid, PomodoroSession.kind == FocusKind.focus
        )
    )
    if (focus or 0) >= 600:
        out.add("focus_10h")

    ch = await db.scalar(
        select(func.count()).select_from(ChallengeParticipant).where(
            ChallengeParticipant.user_id == uid, ChallengeParticipant.completed_at.is_not(None)
        )
    )
    if ch:
        out.add("challenge_done")
    return out


async def evaluate(db: AsyncSession, user: User) -> tuple[list[UserBadge], list[str]]:
    """Yangi nishonlarni yozadi. (barcha olinganlar, yangilari)"""
    have = {b.code: b for b in await db.scalars(select(UserBadge).where(UserBadge.user_id == user.id))}
    new = [c for c in await _earned_now(db, user) if c not in have]
    for code in new:
        db.add(UserBadge(user_id=user.id, code=code))
    if new:
        p = user.profile
        p.xp = sum(BY_CODE[c].xp for c in [*have, *new] if c in BY_CODE)
        p.level = 1 + p.xp // LEVEL_XP
        await db.commit()
    rows = list(await db.scalars(select(UserBadge).where(UserBadge.user_id == user.id)))
    return rows, new

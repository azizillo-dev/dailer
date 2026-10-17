"""Statistikadan "Bilasizmi?" xulosalari. Faqat yetarli ma'lumot bo'lsa va farq sezilarli bo'lsa chiqadi."""

from datetime import date, time, timedelta
from statistics import mean

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckinStatus, DayReflection, FocusKind, PomodoroSession, User
from app.services import stats as st
from app.services.schedule import local_today

WINDOW_DAYS = 56
MIN_GROUP = 3
MIN_DIFF = 8.0

WEEKDAYS = {
    "uz": ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"],
    "ru": ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
    "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
}

T = {
    "uz": {
        "sleep": "23:00 dan oldin uxlagan kunlaringizdan keyingi kun bali o'rtacha {d}% yuqori.",
        "mood": "Kayfiyatingiz yaxshi bo'lgan kunlarda kun bali {d}% yuqori — kayfiyat va tartib bir-birini quvvatlaydi.",
        "weekday": "Eng kuchli kuningiz — {best} ({b}%), eng zaifi — {weak} ({w}%). {weak_cap} uchun rejani yengillashtirib ko'ring.",
        "morning": "Kunning birinchi vazifasini bajargan kunlaringizda qolgan vazifalar {d}% ko'proq bajariladi. Ertalabki g'alaba — butun kun uchun.",
        "focus": "Kamida bitta Pomodoro qilgan kunlaringizda kun bali {d}% yuqori.",
    },
    "ru": {
        "sleep": "После дней, когда вы ложились до 23:00, балл дня в среднем выше на {d}%.",
        "mood": "В дни с хорошим настроением балл выше на {d}% — настроение и порядок поддерживают друг друга.",
        "weekday": "Ваш самый сильный день — {best} ({b}%), самый слабый — {weak} ({w}%). Попробуйте облегчить план на {weak}.",
        "morning": "В дни, когда вы выполнили первую задачу дня, остальные выполняются на {d}% чаще. Утренняя победа — на весь день.",
        "focus": "В дни хотя бы с одним Pomodoro балл дня выше на {d}%.",
    },
    "en": {
        "sleep": "The day after you went to bed before 23:00, your score is {d}% higher on average.",
        "mood": "On good-mood days your score is {d}% higher — mood and order feed each other.",
        "weekday": "Your strongest day is {best} ({b}%), the weakest is {weak} ({w}%). Try a lighter plan for {weak}.",
        "morning": "On days you complete your first task, the rest gets done {d}% more often. A morning win carries the whole day.",
        "focus": "On days with at least one Pomodoro your score is {d}% higher.",
    },
}


def _early(t: time | None) -> bool | None:
    if t is None:
        return None
    # 00:00–05:59 — yarim tundan keyin, demak kech
    return time(6) <= t <= time(23, 0)


def _compare(a: list[float], b: list[float]) -> float | None:
    if len(a) < MIN_GROUP or len(b) < MIN_GROUP:
        return None
    d = mean(a) - mean(b)
    return round(d) if d >= MIN_DIFF else None


async def compute(db: AsyncSession, user: User) -> list[dict]:
    lang = user.profile.language.value if user.profile.language.value in T else "uz"
    tx = T[lang]
    today = local_today(user.profile.timezone)
    start = today - timedelta(days=WINDOW_DAYS)
    end = today - timedelta(days=1)  # bugun hali tugamagan
    ctx = await st.load_context(db, user, start, today)
    days = {d.date: d for d in ctx.range(start, end) if d.total.score is not None}
    if len(days) < 7:
        return []

    out: list[dict] = []
    refl = {
        r.date: r
        for r in await db.scalars(
            select(DayReflection).where(DayReflection.user_id == user.id, DayReflection.date >= start)
        )
    }

    # 1. Uyqu: shu kunga olib kelgan tun (refleksiyadagi slept_at)
    early, late = [], []
    for d, s in days.items():
        e = _early(refl[d].slept_at) if d in refl else None
        if e is True:
            early.append(s.total.score)
        elif e is False:
            late.append(s.total.score)
    if (diff := _compare(early, late)) is not None:
        out.append({"kind": "sleep", "value": diff, "text": tx["sleep"].format(d=diff)})

    # 2. Kayfiyat
    good = [days[d].total.score for d, r in refl.items() if d in days and r.mood and r.mood >= 4]
    bad = [days[d].total.score for d, r in refl.items() if d in days and r.mood and r.mood <= 2]
    if (diff := _compare(good, bad)) is not None:
        out.append({"kind": "mood", "value": diff, "text": tx["mood"].format(d=diff)})

    # 3. Hafta kunlari
    by_wd: dict[int, list[float]] = {}
    for d, s in days.items():
        by_wd.setdefault(d.weekday(), []).append(s.total.score)
    avg = {wd: mean(v) for wd, v in by_wd.items() if len(v) >= 2}
    if len(avg) >= 4:
        best, weak = max(avg, key=avg.get), min(avg, key=avg.get)
        if avg[best] - avg[weak] >= 15:
            names = WEEKDAYS[lang]
            out.append({
                "kind": "weekday", "value": round(avg[best] - avg[weak]),
                "text": tx["weekday"].format(
                    best=names[best], b=round(avg[best]), weak=names[weak], w=round(avg[weak]),
                    weak_cap=names[weak].capitalize(),
                ),
            })

    # 4. Ertalabki birinchi vazifa
    with_first, without_first = [], []
    for d in days:
        alive = sorted(
            (i for i in ctx.items if ctx.alive_on(i, d) and i.start_time is not None), key=lambda i: i.start_time
        )
        if len(alive) < 3:
            continue
        first, rest = alive[0], alive[1:]
        c = ctx.checkins.get((first.id, d))
        done_rest = sum(
            1 for i in rest if (ci := ctx.checkins.get((i.id, d))) and ci.status in (CheckinStatus.done, CheckinStatus.partial)
        )
        share = done_rest / len(rest) * 100
        (with_first if c and c.status == CheckinStatus.done else without_first).append(share)
    if (diff := _compare(with_first, without_first)) is not None:
        out.append({"kind": "morning", "value": diff, "text": tx["morning"].format(d=diff)})

    # 5. Pomodoro
    focus_days = set(
        (
            await db.scalars(
                select(PomodoroSession.date).where(
                    PomodoroSession.user_id == user.id,
                    PomodoroSession.kind == FocusKind.focus,
                    PomodoroSession.completed.is_(True),
                    PomodoroSession.date >= start,
                )
            )
        ).all()
    )
    with_f = [s.total.score for d, s in days.items() if d in focus_days]
    without_f = [s.total.score for d, s in days.items() if d not in focus_days]
    if (diff := _compare(with_f, without_f)) is not None:
        out.append({"kind": "focus", "value": diff, "text": tx["focus"].format(d=diff)})

    out.sort(key=lambda x: -x["value"])
    return out[:4]


def heatmap(ctx: st.StatsContext, year: int) -> list[dict]:
    start = date(year, 1, 1)
    end = min(date(year, 12, 31), ctx.today)
    if end < start:
        return []
    return [
        {"date": d.date, "score": d.total.score, "planned": d.total.planned, "frozen": d.date in ctx.freezes}
        for d in ctx.range(start, end)
    ]

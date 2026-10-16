"""Onboarding javoblaridan boshlang'ich kun tartibi (qoidalarga asoslangan).

AI yordamchi ulanganda shu natija AI'ga "qoralama" sifatida beriladi va u yaxshilaydi.
AI ishlamay qolsa — shu reja o'zi ishlatiladi.
"""

from datetime import date, time

from app.models.routine import ALL_DAYS
from app.services import prayer
from app.services.catalog import TEMPLATES

DAY = 24 * 60
_BY_CODE = {t["code"]: t for t in TEMPLATES}


def _m(t: time) -> int:
    return t.hour * 60 + t.minute


def _t(minutes: int) -> time:
    minutes %= DAY
    return time(minutes // 60, minutes % 60)


def _parse(v) -> time | None:
    if isinstance(v, time):
        return v
    if isinstance(v, str) and v:
        h, m = v.split(":")[:2]
        return time(int(h), int(m))
    return None


class _Slots:
    def __init__(self, day_start: int, day_end: int):
        self.start = day_start
        self.end = day_end
        self.busy: list[tuple[int, int]] = []

    def take(self, start: int, duration: int) -> None:
        self.busy.append((start, start + max(duration, 5)))

    def free(self, start: int, duration: int) -> bool:
        end = start + max(duration, 5)
        if start < self.start or end > self.end:
            return False
        return all(end <= b0 or start >= b1 for b0, b1 in self.busy)

    def place(self, preferred: int, duration: int) -> int | None:
        # Avval afzal vaqtdan keyin, bo'lmasa — undan oldin bo'sh joy qidiriladi
        for s in range(max(preferred, self.start), self.end, 5):
            if self.free(s, duration):
                self.take(s, duration)
                return s
        for s in range(preferred, self.start - 1, -5):
            if self.free(s, duration):
                self.take(s, duration)
                return s
        return None


def _from_template(code: str, lang: str, **overrides) -> dict:
    tpl = _BY_CODE[code]

    def tr(v):
        return (v or {}).get(lang) or (v or {}).get("uz") if isinstance(v, dict) else v

    item = {
        "template_code": code,
        "title": tr(tpl["title"]),
        "category": tpl["category"],
        "icon": tpl["icon"],
        "start_time": tpl.get("default_time"),
        "duration_min": tpl.get("default_duration_min"),
        "days_of_week": ALL_DAYS,
        "prayer_name": tpl.get("prayer_name"),
        "time_from_prayer": tpl.get("prayer_name") is not None,
        "target_value": tpl.get("default_target"),
        "unit": tr(tpl.get("unit")),
        "min_version_text": tr(tpl.get("min_version")),
    }
    item.update(overrides)
    return item


def starter_plan(profile, today: date | None = None) -> list[dict]:
    lang = profile.language.value if hasattr(profile.language, "value") else profile.language
    user_type = profile.user_type.value if profile.user_type is not None else "other"
    interests = set(profile.interests or [])
    today = today or date.today()

    wake = _m(profile.wake_time or time(6, 0))
    sleep = _m(profile.sleep_time or time(23, 0))
    if sleep <= wake:
        sleep += DAY  # yarim tundan keyin uxlaydi

    slots = _Slots(wake, sleep)
    plan: list[dict] = []

    def add_fixed(item: dict, start: int, duration: int | None):
        slots.take(start, duration or 5)
        plan.append(item)

    def add_flexible(code: str, preferred: int, **overrides):
        tpl = _BY_CODE[code]
        duration = overrides.get("duration_min", tpl.get("default_duration_min") or 15)
        start = slots.place(preferred, duration)
        if start is not None:
            plan.append(_from_template(code, lang, start_time=_t(start), **overrides))
        return start

    # 1. Uyg'onish va uyqu
    add_fixed(_from_template("wake_up", lang, start_time=_t(wake)), wake, 10)
    add_fixed(_from_template("sleep", lang, start_time=_t(sleep)), sleep, 0)

    # 2. Namozlar — haqiqiy vaqtlar bo'yicha joy band qilinadi
    fajr_end = wake
    if profile.prays:
        times = prayer.for_profile(profile, today)
        for name in ("fajr", "dhuhr", "asr", "maghrib", "isha"):
            if name not in times:
                continue
            start = _m(times[name])
            if start < wake:
                start = wake + 10  # uyg'ongandan keyin o'qiladi
            # start_time — ko'rsatish uchun; har kuni haqiqiy vaqt qayta hisoblanadi
            add_fixed(_from_template(f"prayer_{name}", lang, start_time=_t(start)), start, 15)
            if name == "fajr":
                fajr_end = start + 15

    # 3. Band vaqtlar (darslar, ish)
    busy_end = None
    for block in profile.busy_blocks or []:
        start, end = _parse(block.get("start")), _parse(block.get("end"))
        if start is None or end is None or _m(end) <= _m(start):
            continue
        category = "study" if user_type in ("university_student", "school_pupil") else "work"
        icon = "graduation" if category == "study" else "briefcase"
        duration = _m(end) - _m(start)
        add_fixed(
            {
                "template_code": None,
                "title": (block.get("label") or "").strip()[:120]
                or {"uz": "Darslar", "ru": "Занятия", "en": "Classes"}[lang],
                "category": category,
                "icon": icon,
                "start_time": start,
                "duration_min": duration,
                "days_of_week": int(block.get("days") or 31),
                "prayer_name": None,
                "time_from_prayer": False,
                "target_value": None,
                "unit": None,
                "min_version_text": None,
            },
            _m(start),
            duration,
        )
        busy_end = max(busy_end or 0, _m(end))

    # 4. Ertalabki odatlar
    morning = max(wake + 10, fajr_end)
    add_flexible("plan_day", morning)
    if "quran" in interests:
        add_flexible("quran", morning + 5)
    if interests & {"sport", "health"}:
        add_flexible("morning_exercise", morning + 15)
    if "reading" in interests:
        add_flexible("reading", morning + 30)

    # 5. Kunduzgi va kechki ishlar
    afternoon = (busy_end or _m(time(13, 0))) + 60
    if user_type in ("university_student", "school_pupil"):
        add_flexible("homework", afternoon)
    elif not profile.busy_blocks:
        add_flexible("deep_work", max(wake + 120, _m(time(9, 0))))
    if "math" in interests:
        add_flexible("math", afternoon + 90)
    if "sport" in interests:
        add_flexible("workout", _m(time(18, 0)))
    if "programming" in interests:
        add_flexible("coding", _m(time(20, 0)))
    if "language" in interests:
        add_flexible("vocabulary", _m(time(20, 30)))

    # 6. Kun yakuni
    add_flexible("reflection", sleep - 30)

    # Yarim tundan keyingi uyqu ham kun oxirida tursin
    def minute_of_day(i) -> int:
        m = _m(i["start_time"]) if i["start_time"] else DAY
        return m + DAY if m < wake else m

    plan.sort(key=minute_of_day)
    for order, item in enumerate(plan):
        item["sort_order"] = order * 10
    return plan

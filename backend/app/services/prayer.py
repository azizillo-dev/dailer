"""Namoz vaqtlarini astronomik hisoblash (PrayTimes.org algoritmi asosida).

Natija — mahalliy vaqt. Har bir namozga foydalanuvchi ±daqiqa tuzatish kiritishi mumkin
(rasmiy taqvim bilan moslashtirish uchun).
"""

import math
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

# Joylashuv kiritilmagan bo'lsa — Toshkent
DEFAULT_LAT = 41.2995
DEFAULT_LNG = 69.2401


@dataclass(frozen=True)
class Method:
    fajr_angle: float
    isha_angle: float | None = None
    # Isha shomdan necha daqiqa keyin (burchak o'rniga)
    isha_minutes: int | None = None


METHODS: dict[str, Method] = {
    "muslim_world_league": Method(18, 17),
    "isna": Method(15, 15),
    "egypt": Method(19.5, 17.5),
    "karachi": Method(18, 18),
    "umm_al_qura": Method(18.5, isha_minutes=90),
    "tehran": Method(17.7, 14),
    "turkey": Method(18, 17),
}
DEFAULT_METHOD = "muslim_world_league"

NAMES = ("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")


def _dsin(d): return math.sin(math.radians(d))
def _dcos(d): return math.cos(math.radians(d))
def _dtan(d): return math.tan(math.radians(d))
def _darcsin(x): return math.degrees(math.asin(x))
def _darccos(x): return math.degrees(math.acos(x))
def _darctan2(y, x): return math.degrees(math.atan2(y, x))
def _darccot(x): return math.degrees(math.atan(1 / x))
def _fix(a, b): return a - b * math.floor(a / b)


def _julian(d: date) -> float:
    y, m = d.year, d.month
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + d.day + b - 1524.5


def _sun_position(jd: float) -> tuple[float, float]:
    """(og'ish, vaqt tenglamasi)"""
    d = jd - 2451545.0
    g = _fix(357.529 + 0.98560028 * d, 360)
    q = _fix(280.459 + 0.98564736 * d, 360)
    lam = _fix(q + 1.915 * _dsin(g) + 0.020 * _dsin(2 * g), 360)
    e = 23.439 - 0.00000036 * d
    ra = _darctan2(_dcos(e) * _dsin(lam), _dcos(lam)) / 15
    eqt = q / 15 - _fix(ra, 24)
    decl = _darcsin(_dsin(e) * _dsin(lam))
    return decl, eqt


class _Calc:
    def __init__(self, lat: float, lng: float, d: date):
        self.lat = lat
        self.jd = _julian(d) - lng / (15 * 24)

    def mid_day(self, t: float) -> float:
        _, eqt = _sun_position(self.jd + t)
        return _fix(12 - eqt, 24)

    def sun_angle_time(self, angle: float, t: float, ccw: bool = False) -> float | None:
        decl, _ = _sun_position(self.jd + t)
        noon = self.mid_day(t)
        x = (-_dsin(angle) - _dsin(decl) * _dsin(self.lat)) / (_dcos(decl) * _dcos(self.lat))
        if not -1 <= x <= 1:
            # Juda shimoliy kenglikda quyosh bu burchakka tushmaydi
            return None
        h = _darccos(x) / 15
        return noon + (-h if ccw else h)

    def asr_time(self, factor: int, t: float) -> float | None:
        decl, _ = _sun_position(self.jd + t)
        angle = -_darccot(factor + _dtan(abs(self.lat - decl)))
        return self.sun_angle_time(angle, t)


def compute(
    d: date,
    lat: float | None,
    lng: float | None,
    tz: str,
    method: str = DEFAULT_METHOD,
    madhab: str = "hanafi",
    offsets: dict[str, int] | None = None,
) -> dict[str, time]:
    lat = DEFAULT_LAT if lat is None else float(lat)
    lng = DEFAULT_LNG if lng is None else float(lng)
    m = METHODS.get(method, METHODS[DEFAULT_METHOD])
    calc = _Calc(lat, lng, d)

    # Boshlang'ich taxminiy vaqtlar (soat, kun ulushi sifatida)
    t = {"fajr": 5, "sunrise": 6, "dhuhr": 12, "asr": 13, "sunset": 18, "isha": 18}
    p = {k: v / 24 for k, v in t.items()}

    raw = {
        "fajr": calc.sun_angle_time(m.fajr_angle, p["fajr"], ccw=True),
        "sunrise": calc.sun_angle_time(0.833, p["sunrise"], ccw=True),
        "dhuhr": calc.mid_day(p["dhuhr"]),
        "asr": calc.asr_time(2 if madhab == "hanafi" else 1, p["asr"]),
        "sunset": calc.sun_angle_time(0.833, p["sunset"]),
    }
    raw["maghrib"] = raw["sunset"]
    if m.isha_minutes is not None and raw["maghrib"] is not None:
        raw["isha"] = raw["maghrib"] + m.isha_minutes / 60
    else:
        raw["isha"] = calc.sun_angle_time(m.isha_angle or 17, p["isha"])

    # Tun yarmiga asoslangan zaxira (kenglik juda baland bo'lsa)
    if raw["sunrise"] is not None and raw["sunset"] is not None:
        night = 24 - (raw["sunset"] - raw["sunrise"])
        if raw["fajr"] is None:
            raw["fajr"] = raw["sunrise"] - night / 7
        if raw["isha"] is None:
            raw["isha"] = raw["sunset"] + night / 7

    utc_offset = (
        datetime.combine(d, time(12), ZoneInfo(tz)).utcoffset() or timedelta(0)
    ).total_seconds() / 3600
    shift = utc_offset - lng / 15
    offsets = offsets or {}

    result: dict[str, time] = {}
    for name in NAMES:
        value = raw[name]
        if value is None:
            continue
        minutes = (value + shift) * 60 + offsets.get(name, 0)
        # Peshinni quyosh zenitdan o'tgandan keyin 1 daqiqa — an'anaviy ehtiyot
        if name == "dhuhr":
            minutes += 1
        minutes = round(minutes) % (24 * 60)
        result[name] = time(int(minutes // 60), int(minutes % 60))
    return result


def for_profile(profile, d: date) -> dict[str, time]:
    return compute(
        d,
        profile.latitude,
        profile.longitude,
        profile.timezone,
        profile.prayer_method,
        profile.madhab.value if hasattr(profile.madhab, "value") else profile.madhab,
        profile.prayer_offsets,
    )

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.db.session import SessionLocal
from app.models import Checkin, CheckinStatus, RoutineItem
from app.services.screen_time import period_range
from app.services.schedule import local_today
from tests.conftest import auth, register

API = "/api/v1"


async def setup(client):
    data = await register(client)
    h = auth(data["tokens"]["access_token"])
    await client.patch(f"{API}/me/profile", json={"timezone": "Asia/Tashkent"}, headers=h)
    return h


def day(d, total, apps=(), pickups=None):
    return {"date": d.isoformat(), "total_min": total, "pickups": pickups, "apps": [dict(a) for a in apps]}


async def test_sync_and_week_summary(client):
    h = await setup(client)
    today = local_today("Asia/Tashkent")
    ws, _ = period_range("week", 0, today)
    ig = {"id": "com.instagram.android", "name": "Instagram", "minutes": 60}
    tg = {"id": "org.telegram.messenger", "name": "Telegram", "minutes": 30}
    days = [day(ws + timedelta(days=i), 120 + i * 10, [ig, tg], pickups=50) for i in range((today - ws).days + 1)]
    res = await client.put(f"{API}/screen-time/days", json={"source": "android", "days": days}, headers=h)
    assert res.status_code == 200 and res.json()["saved"] == len(days)

    # O'tgan hafta — solishtirish uchun
    prev = [day(ws - timedelta(days=i), 300) for i in range(1, 8)]
    await client.put(f"{API}/screen-time/days", json={"source": "manual", "days": prev}, headers=h)

    s = (await client.get(f"{API}/screen-time?period=week", headers=h)).json()
    assert len(s["days"]) == 7
    assert s["total_min"] == sum(d["total_min"] for d in days)
    assert s["avg_min"] == round(s["total_min"] / len(days))
    assert s["prev_avg_min"] == 300 and s["delta_pct"] < 0
    assert s["top_apps"][0]["name"] == "Instagram" and s["top_apps"][0]["minutes"] == 60 * len(days)
    assert s["avg_pickups"] == 50
    assert s["best_day"] == ws.isoformat()

    # Qayta yuborish — yangilaydi, takrorlamaydi
    await client.put(f"{API}/screen-time/days", json={"source": "android", "days": [day(today, 15)]}, headers=h)
    s2 = (await client.get(f"{API}/screen-time", headers=h)).json()
    assert [d["total_min"] for d in s2["days"] if d["date"] == today.isoformat()] == [15]


async def test_manual_keeps_android_apps(client):
    h = await setup(client)
    today = local_today("Asia/Tashkent")
    app = {"id": "com.youtube", "name": "YouTube", "minutes": 40}
    await client.put(f"{API}/screen-time/days", json={"source": "android", "days": [day(today, 90, [app])]}, headers=h)
    await client.put(f"{API}/screen-time/days", json={"source": "manual", "days": [day(today, 100)]}, headers=h)
    s = (await client.get(f"{API}/screen-time", headers=h)).json()
    t = next(d for d in s["days"] if d["date"] == today.isoformat())
    assert t["total_min"] == 100 and t["source"] == "manual"
    assert s["top_apps"][0]["name"] == "YouTube"

    assert (await client.delete(f"{API}/screen-time/days/{today}", headers=h)).status_code == 204
    s = (await client.get(f"{API}/screen-time", headers=h)).json()
    assert s["total_min"] == 0 and s["avg_min"] is None


async def test_validation_and_limit(client):
    h = await setup(client)
    today = local_today("Asia/Tashkent")
    bad = [
        [day(today + timedelta(days=1), 10)],  # kelajak
        [day(today, 24 * 60 + 1)],  # sutkadan ko'p
        [day(today, 10), day(today, 20)],  # takroriy sana
        [day(today - timedelta(days=90), 10)],  # juda eski
    ]
    for days in bad:
        assert (await client.put(f"{API}/screen-time/days", json={"days": days}, headers=h)).status_code == 422

    assert (await client.put(f"{API}/screen-time/limit", json={"limit_min": 5}, headers=h)).status_code == 422
    assert (await client.put(f"{API}/screen-time/limit", json={"limit_min": 120}, headers=h)).json() == {"limit_min": 120}
    await client.put(
        f"{API}/screen-time/days", json={"days": [day(today, 150), day(today - timedelta(days=1), 60)]}, headers=h
    )
    s = (await client.get(f"{API}/screen-time?period=month", headers=h)).json()
    assert s["limit_min"] == 120
    # Faqat bugun (150 > 120) chegaradan oshgan
    assert s["days_over_limit"] == 1
    assert len(s["days"]) >= 28


async def test_correlation_insight(client):
    h = await setup(client)
    today = local_today("Asia/Tashkent")
    r = await client.post(f"{API}/routine-items", json={"title": "A", "category": "custom", "start_time": "06:00"}, headers=h)
    item_id = uuid.UUID(r.json()["id"])
    me = (await client.get(f"{API}/me", headers=h)).json()
    uid = uuid.UUID(me["id"])
    async with SessionLocal() as db:
        await db.execute(update(RoutineItem).where(RoutineItem.id == item_id).values(created_at=datetime.now(UTC) - timedelta(days=40)))
        stamp = datetime.now(UTC)
        days = []
        for back in range(1, 21):
            d = today - timedelta(days=back)
            low = back % 2 == 0
            # Telefon kam ishlatilgan kunlar — vazifa bajarilgan
            if low:
                db.add(Checkin(user_id=uid, routine_item_id=item_id, date=d, status=CheckinStatus.done, checked_at=stamp, updated_at=stamp))
            days.append(day(d, 90 if low else 360))
        await db.commit()
    await client.put(f"{API}/screen-time/days", json={"days": days}, headers=h)
    ins = (await client.get(f"{API}/screen-time", headers=h)).json()["insight"]
    assert ins and ins["threshold_min"] == 90 and ins["low_score"] == 100 and ins["high_score"] == 0

    # AI kontekstiga ham tushadi
    from app.models import User
    from app.services.ai.context import build_context

    async with SessionLocal() as db:
        user = await db.get(User, uid)
        ctx = await build_context(db, user)
    # Oxirgi 7 kun: 3 kun 90, 4 kun 360 daqiqa
    assert ctx["screen_time"]["avg_min_per_day"] == round((3 * 90 + 4 * 360) / 7)


def test_period_range_month_edges():
    from datetime import date

    assert period_range("month", 0, date(2026, 12, 15)) == (date(2026, 12, 1), date(2026, 12, 31))
    assert period_range("month", -1, date(2026, 1, 10)) == (date(2025, 12, 1), date(2025, 12, 31))
    assert period_range("month", -13, date(2026, 1, 10)) == (date(2024, 12, 1), date(2024, 12, 31))
    assert period_range("week", -1, date(2026, 10, 17)) == (date(2026, 10, 5), date(2026, 10, 11))


def test_fallback_mentions_screen_time():
    from app.services.ai.fallback import analysis

    ctx = {"last_7_days": {"score": 70, "prev_7_days_score": 70}, "screen_time": {"avg_min_per_day": 185, "prev_avg_min_per_day": 240}}
    out = analysis(ctx, "uz", note=False)
    assert "3 soat 5 daqiqa" in out and "55 daqiqa kam" in out

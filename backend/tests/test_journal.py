import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import update

from app.db.session import SessionLocal
from app.models import Checkin, CheckinStatus, DayReflection, RoutineItem
from app.services.schedule import local_today
from tests.conftest import auth, register

API = "/api/v1"


async def setup(client, items=("A", "B", "C"), days_back=30):
    data = await register(client)
    h = auth(data["tokens"]["access_token"])
    await client.patch(f"{API}/me/profile", json={"timezone": "Asia/Tashkent"}, headers=h)
    ids = []
    for i, title in enumerate(items):
        r = await client.post(
            f"{API}/routine-items", json={"title": title, "category": "custom", "start_time": f"0{6 + i}:00"}, headers=h
        )
        ids.append(uuid.UUID(r.json()["id"]))
    async with SessionLocal() as db:
        await db.execute(
            update(RoutineItem).where(RoutineItem.id.in_(ids)).values(created_at=datetime.now(UTC) - timedelta(days=days_back))
        )
        await db.commit()
    me = (await client.get(f"{API}/me", headers=h)).json()
    return h, ids, uuid.UUID(me["id"])


async def mark(user_id, rows):
    stamp = datetime.now(UTC)
    async with SessionLocal() as db:
        for item_id, d in rows:
            db.add(Checkin(user_id=user_id, routine_item_id=item_id, date=d, status=CheckinStatus.done,
                           checked_at=stamp, updated_at=stamp))
        await db.commit()


async def test_reflection_upsert(client):
    h, _, _ = await setup(client)
    today = local_today("Asia/Tashkent")
    res = await client.put(
        f"{API}/journal/{today}", json={"mood": 4, "energy": 3, "note": " Yaxshi kun ", "slept_at": "22:45", "woke_at": "05:00"},
        headers=h,
    )
    assert res.status_code == 200
    got = (await client.get(f"{API}/journal/{today}", headers=h)).json()
    assert got["mood"] == 4 and got["note"] == "Yaxshi kun" and got["slept_at"] == "22:45:00" and got["filled"]
    # Qisman yangilash
    await client.put(f"{API}/journal/{today}", json={"mood": 5}, headers=h)
    got = (await client.get(f"{API}/journal/{today}", headers=h)).json()
    assert got["mood"] == 5 and got["energy"] == 3
    future = (today + timedelta(days=1)).isoformat()
    assert (await client.put(f"{API}/journal/{future}", json={"mood": 3}, headers=h)).status_code == 422
    assert (await client.put(f"{API}/journal/{today}", json={"mood": 9}, headers=h)).status_code == 422


async def test_streak_freeze_keeps_chain(client):
    h, ids, uid = await setup(client)
    today = local_today("Asia/Tashkent")
    rows = []
    for back in (1, 2, 4, 5, 6):  # 3 kun oldin — uzilish
        rows += [(i, today - timedelta(days=back)) for i in ids]
    await mark(uid, rows)
    assert (await client.get(f"{API}/stats/streak", headers=h)).json()["current"] == 2

    cands = (await client.get(f"{API}/stats/freeze-candidates", headers=h)).json()
    broken = (today - timedelta(days=3)).isoformat()
    assert broken in [c["date"] for c in cands]

    # Uzilmagan kunni muzlatib bo'lmaydi
    ok_day = (today - timedelta(days=1)).isoformat()
    assert (await client.post(f"{API}/streak/freezes", json={"date": ok_day}, headers=h)).status_code == 422

    res = await client.post(f"{API}/streak/freezes", json={"date": broken}, headers=h)
    assert res.status_code == 201
    assert res.json()["streak"]["current"] == 5  # 1,2 + (3 muzlatilgan) + 4,5,6
    info = (await client.get(f"{API}/streak/freezes", headers=h)).json()
    assert info["used"] == 1 and info["left"] == 1
    # Shu kunni ikki marta muzlatib bo'lmaydi
    assert (await client.post(f"{API}/streak/freezes", json={"date": broken}, headers=h)).status_code == 422


async def test_heatmap(client):
    h, ids, uid = await setup(client, days_back=10)
    today = local_today("Asia/Tashkent")
    await mark(uid, [(i, today - timedelta(days=2)) for i in ids])
    res = (await client.get(f"{API}/stats/heatmap", headers=h)).json()
    assert res["year"] == today.year
    by_date = {d["date"]: d for d in res["days"]}
    assert by_date[(today - timedelta(days=2)).isoformat()]["score"] == 100.0
    assert res["perfect_days"] == 1
    # Vazifalar yaratilishidan oldingi kunlar — reja yo'q
    if today.timetuple().tm_yday > 20:
        assert by_date[(today - timedelta(days=15)).isoformat()]["planned"] == 0


async def test_insights_sleep_and_weekday(client):
    h, ids, uid = await setup(client, days_back=40)
    today = local_today("Asia/Tashkent")
    rows = []
    reflections = []
    for back in range(1, 29):
        d = today - timedelta(days=back)
        early = back % 2 == 0
        # Erta uxlagan kunlar — hammasi bajarilgan, kech — faqat bittasi
        rows += [(i, d) for i in (ids if early else ids[:1])]
        reflections.append(DayReflection(user_id=uid, date=d, slept_at=time(22, 30) if early else time(0, 40), mood=4 if early else 2))
    await mark(uid, rows)
    async with SessionLocal() as db:
        db.add_all(reflections)
        await db.commit()

    found = (await client.get(f"{API}/stats/insights", headers=h)).json()
    kinds = {i["kind"]: i for i in found}
    assert "sleep" in kinds and kinds["sleep"]["value"] >= 60
    assert "23:00" in kinds["sleep"]["text"]
    assert "mood" in kinds
    assert "morning" not in kinds or kinds["morning"]["value"] >= 8


async def test_no_insights_without_data(client):
    h, _, _ = await setup(client, days_back=3)
    assert (await client.get(f"{API}/stats/insights", headers=h)).json() == []


def test_early_helper():
    from app.services.insights import _early

    assert _early(time(22, 0)) is True and _early(time(23, 30)) is False and _early(time(1, 0)) is False
    assert _early(None) is None
    _ = date  # noqa

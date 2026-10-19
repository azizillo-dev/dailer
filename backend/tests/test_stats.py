import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import update

from app.db.session import SessionLocal
from app.models import Checkin, CheckinStatus, RoutineItem
from app.services.schedule import local_today
from tests.conftest import auth, register

API = "/api/v1"


async def setup_user(client):
    token = (await register(client))["tokens"]["access_token"]
    h = auth(token)
    await client.patch(f"{API}/me/profile", json={"timezone": "Asia/Tashkent"}, headers=h)
    ids = {}
    for title, cat in (("Bomdod", "prayer"), ("Kitob", "reading")):
        res = await client.post(
            f"{API}/routine-items",
            json={"title": title, "category": cat, "start_time": "06:00"},
            headers=h,
        )
        ids[cat] = uuid.UUID(res.json()["id"])
    # Vazifalar 30 kun oldin yaratilgandek
    async with SessionLocal() as db:
        await db.execute(
            update(RoutineItem)
            .where(RoutineItem.id.in_(ids.values()))
            .values(created_at=datetime.now(UTC) - timedelta(days=30))
        )
        await db.commit()
    me = (await client.get(f"{API}/me", headers=h)).json()
    return h, ids, uuid.UUID(me["id"])


async def add_checkins(user_id, rows):
    stamp = datetime.now(UTC)
    async with SessionLocal() as db:
        for item_id, d, status in rows:
            db.add(Checkin(
                user_id=user_id, routine_item_id=item_id, date=d, status=status,
                checked_at=stamp, updated_at=stamp,
            ))
        await db.commit()


async def test_weekly_scores_and_delta(client):
    h, ids, uid = await setup_user(client)
    today = local_today("Asia/Tashkent")
    this_monday = today - timedelta(days=today.weekday())
    last_monday = this_monday - timedelta(days=7)

    rows = []
    # O'tgan hafta: namoz har kuni, kitob hech qachon → 50%
    for i in range(7):
        rows.append((ids["prayer"], last_monday + timedelta(days=i), CheckinStatus.done))
    # Shu hafta (bugungacha): ikkalasi ham bajarilgan
    d = this_monday
    while d < today:
        rows.append((ids["prayer"], d, CheckinStatus.done))
        rows.append((ids["reading"], d, CheckinStatus.done))
        d += timedelta(days=1)
    await add_checkins(uid, rows)

    prev = (await client.get(f"{API}/stats/weekly?start={last_monday}", headers=h)).json()
    assert prev["total"]["score"] == 50.0
    cats = {c["category"]: c for c in prev["categories"]}
    assert cats["prayer"]["score"] == 100.0
    assert cats["reading"]["score"] == 0.0
    assert len(prev["days"]) == 7

    cur = (await client.get(f"{API}/stats/weekly", headers=h)).json()
    assert cur["week_start"] == this_monday.isoformat()
    assert cur["is_current"] is True
    if today != this_monday:
        # Bugun hali ochiq — hisobga olinmaydi, o'tgan kunlar 100%
        assert cur["total"]["score"] == 100.0
        assert cur["delta"] == 50.0
        assert {c["category"]: c["delta"] for c in cur["categories"]}["reading"] == 100.0


async def test_unmarked_past_counts_as_missed_today_open(client):
    h, ids, uid = await setup_user(client)
    today = local_today("Asia/Tashkent")
    res = (await client.get(f"{API}/stats/weekly?start={today}", headers=h)).json()
    today_row = next(d for d in res["days"] if d["date"] == today.isoformat())
    assert today_row["planned"] == 2 and today_row["missed"] == 0 and today_row["score"] is None
    if today.weekday() > 0:
        yesterday_row = next(d for d in res["days"] if d["date"] == (today - timedelta(days=1)).isoformat())
        assert yesterday_row["missed"] == 2 and yesterday_row["score"] == 0.0


async def test_excused_excluded(client):
    h, ids, uid = await setup_user(client)
    day = local_today("Asia/Tashkent") - timedelta(days=1)
    await add_checkins(uid, [
        (ids["prayer"], day, CheckinStatus.excused),
        (ids["reading"], day, CheckinStatus.partial),
    ])
    res = (await client.get(f"{API}/stats/weekly?start={day}", headers=h)).json()
    row = next(d for d in res["days"] if d["date"] == day.isoformat())
    assert row["excused"] == 1 and row["score"] == 50.0


async def test_streak(client):
    h, ids, uid = await setup_user(client)
    today = local_today("Asia/Tashkent")
    rows = []
    for back in range(1, 6):  # oxirgi 5 kun to'liq
        d = today - timedelta(days=back)
        rows += [(ids["prayer"], d, CheckinStatus.done), (ids["reading"], d, CheckinStatus.done)]
    # 6 kun oldin — uzilish, undan oldin 8 kun
    for back in range(7, 15):
        d = today - timedelta(days=back)
        rows += [(ids["prayer"], d, CheckinStatus.done), (ids["reading"], d, CheckinStatus.partial)]
    await add_checkins(uid, rows)
    s = (await client.get(f"{API}/stats/streak", headers=h)).json()
    assert s["current"] == 5
    assert s["longest"] == 8


async def test_category_breakdown(client):
    h, ids, uid = await setup_user(client)
    today = local_today("Asia/Tashkent")
    rows = [(ids["reading"], today - timedelta(days=b), CheckinStatus.done) for b in (1, 2, 3)]
    await add_checkins(uid, rows)
    res = (await client.get(
        f"{API}/stats/category/reading?from={today - timedelta(days=6)}&to={today}", headers=h
    )).json()
    assert res["total"]["done"] == 3
    assert res["total"]["missed"] == 3  # 6 o'tgan kundan 3 tasi belgilanmagan
    assert res["items"][0]["title"] == "Kitob"
    bad = await client.get(f"{API}/stats/category/reading?from=2020-01-01&to={today}", headers=h)
    assert bad.status_code == 422


def test_week_start():
    from app.services.stats import week_start

    assert week_start(date(2026, 10, 18)) == date(2026, 10, 12)  # yakshanba → dushanba
    assert week_start(date(2026, 10, 12)) == date(2026, 10, 12)


async def test_week_grid(client):
    h, ids, uid = await setup_user(client)
    today = local_today("Asia/Tashkent")
    last_monday = today - timedelta(days=today.weekday()) - timedelta(days=7)
    # Kitob — miqdorli: kuniga 10 bet
    await client.patch(f"{API}/routine-items/{ids['reading']}", json={"target_value": 10, "unit": "bet"}, headers=h)

    rows = []
    for i in range(7):  # o'tgan hafta: namoz har kuni bajarilgan
        rows.append((ids["prayer"], last_monday + timedelta(days=i), CheckinStatus.done))
    # Kitob: dushanba bajarildi, seshanba qisman (4 bet), qolgani o'tkazilgan
    rows.append((ids["reading"], last_monday, CheckinStatus.done))
    await add_checkins(uid, rows)
    stamp = datetime.now(UTC)
    async with SessionLocal() as db:
        db.add(Checkin(user_id=uid, routine_item_id=ids["reading"], date=last_monday + timedelta(days=1),
                       status=CheckinStatus.partial, value=4, checked_at=stamp, updated_at=stamp))
        await db.commit()

    g = (await client.get(f"{API}/stats/week-grid?start={last_monday}", headers=h)).json()
    assert g["week_start"] == last_monday.isoformat() and len(g["days"]) == 7
    by = {r["title"]: r for r in g["rows"]}
    pr, rd = by["Bomdod"], by["Kitob"]
    assert [c["state"] for c in pr["cells"]] == ["done"] * 7 and pr["done"] == 7 and pr["scheduled"] == 7
    assert [c["state"] for c in rd["cells"]][:3] == ["done", "partial", "missed"]
    assert rd["cells"][1]["progress"] == 0.4 and rd["cells"][0]["progress"] == 1.0
    assert rd["value"] == 14.0 and rd["value_target"] == 70.0 and rd["unit"] == "bet"
    # Mukammal kun — faqat dushanba (ikkalasi ham bajarilgan)
    assert g["perfect_days"] == 1
    assert g["checkins"] == 9  # 7 namoz + 1 kitob + 1 qisman
    # Namoz zanjiri: o'tgan hafta 7 kun, shu hafta belgilanmagan → bugun ochiq, kecha (agar shu haftada) uzilgan
    assert g["best_streak"] is None or g["best_streak"]["title"] == "Bomdod"

    # Kelajak haftasi — rad etiladi
    nxt = today + timedelta(days=8)
    assert (await client.get(f"{API}/stats/week-grid?start={nxt}", headers=h)).status_code == 422


def test_item_streak_rules():
    from types import SimpleNamespace
    from zoneinfo import ZoneInfo

    from app.services.stats import StatsContext, item_streak

    today = date(2026, 10, 18)
    item = SimpleNamespace(id=uuid.uuid4(), created_at=datetime(2026, 9, 1, tzinfo=UTC), archived_at=None,
                           is_active=True, days_of_week=127, mode=None)
    user = SimpleNamespace(profile=SimpleNamespace(timezone="Asia/Tashkent"))

    def ck(d, s):
        return SimpleNamespace(routine_item_id=item.id, date=d, status=s)

    rows = [ck(today - timedelta(days=i), CheckinStatus.done) for i in (1, 2, 4)]
    rows.append(ck(today - timedelta(days=3), CheckinStatus.excused))  # uzrli — uzmaydi
    rows.append(ck(today - timedelta(days=5), CheckinStatus.missed))
    ctx = StatsContext(user, [item], rows, today)
    assert ctx.tz == ZoneInfo("Asia/Tashkent")
    # Bugun ochiq (o'tkaziladi), 1,2 done, 3 uzrli, 4 done, 5 missed → 3
    assert item_streak(ctx, item) == 3

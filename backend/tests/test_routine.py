from datetime import date, time, timedelta

import pytest

from app.db.session import SessionLocal
from app.models import TaskTemplate
from app.services import prayer
from app.services.catalog import TEMPLATES
from tests.conftest import auth, register

API = "/api/v1"


@pytest.fixture
async def templates():
    async with SessionLocal() as db:
        for t in TEMPLATES:
            db.add(TaskTemplate(**{k: v for k, v in t.items()}, is_active=True))
        await db.commit()


@pytest.fixture
async def token(client):
    return (await register(client))["tokens"]["access_token"]


async def onboard(client, token, **extra):
    body = {
        "user_type": "university_student",
        "birth_year": 2005,
        "wake_time": "05:00",
        "sleep_time": "23:00",
        "prays": True,
        "main_goal": "Yaxshi dasturchi bo'lish",
        "interests": ["reading", "sport", "programming", "language"],
        "busy_blocks": [{"label": "Darslar", "start": "08:00", "end": "12:20", "days": 31}],
        "latitude": 41.2995,
        "longitude": 69.2401,
        "timezone": "Asia/Tashkent",
        **extra,
    }
    res = await client.post(f"{API}/me/onboarding", json=body, headers=auth(token))
    assert res.status_code == 200, res.text
    return res.json()


def test_prayer_times_plausible():
    # London, 21-iyun: quyosh ~04:43 da chiqadi, ~21:21 da botadi
    t = prayer.compute(date(2026, 6, 21), 51.5072, -0.1276, "Europe/London")
    assert abs((t["sunrise"].hour * 60 + t["sunrise"].minute) - (4 * 60 + 43)) <= 3
    assert abs((t["maghrib"].hour * 60 + t["maghrib"].minute) - (21 * 60 + 21)) <= 3
    # Tartib to'g'ri
    order = [t[n] for n in ("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")]
    assert order == sorted(order)


def test_prayer_offsets_applied():
    base = prayer.compute(date(2026, 10, 16), 41.3, 69.24, "Asia/Tashkent")
    shifted = prayer.compute(date(2026, 10, 16), 41.3, 69.24, "Asia/Tashkent", offsets={"fajr": 5})
    delta = (shifted["fajr"].hour * 60 + shifted["fajr"].minute) - (base["fajr"].hour * 60 + base["fajr"].minute)
    assert delta == 5


async def test_templates_list(client, token, templates):
    res = await client.get(f"{API}/templates", headers=auth(token))
    assert res.status_code == 200
    codes = [t["code"] for t in res.json()]
    assert "prayer_fajr" in codes and "reading" in codes
    res = await client.get(f"{API}/templates?category=prayer", headers=auth(token))
    assert len(res.json()) == 5


async def test_starter_plan_and_bulk(client, token, templates):
    await onboard(client, token)
    plan = (await client.get(f"{API}/routine/starter-plan", headers=auth(token))).json()
    codes = [p["template_code"] for p in plan]

    assert "wake_up" in codes and "sleep" in codes
    assert sum(1 for p in plan if p["category"] == "prayer") == 5
    assert "reading" in codes and "workout" in codes and "coding" in codes and "vocabulary" in codes
    assert any(p["title"] == "Darslar" for p in plan)

    # Moslashuvchan vazifalar darslar bilan ustma-ust tushmaydi
    def span(p):
        s = time.fromisoformat(p["start_time"])
        start = s.hour * 60 + s.minute
        return start, start + (p["duration_min"] or 5)

    classes = span(next(p for p in plan if p["title"] == "Darslar"))
    for p in plan:
        if p["template_code"] in ("reading", "homework", "coding", "workout", "vocabulary"):
            a, b = span(p)
            assert b <= classes[0] or a >= classes[1], p

    res = await client.post(f"{API}/routine-items/bulk", json={"items": plan}, headers=auth(token))
    assert res.status_code == 201, res.text
    assert len(res.json()) == len(plan)
    assert all(i["template_id"] for i in res.json() if i["title"] != "Darslar")


async def test_plan_without_prayer(client, token, templates):
    await onboard(client, token, prays=False, interests=["reading"])
    plan = (await client.get(f"{API}/routine/starter-plan", headers=auth(token))).json()
    assert not any(p["category"] == "prayer" for p in plan)


async def test_crud_and_today(client, token):
    h = auth(token)
    await onboard(client, token)
    wake = await client.post(
        f"{API}/routine-items",
        json={"title": "Uyg'onish", "category": "sleep", "start_time": "05:00", "icon": "alarm"},
        headers=h,
    )
    assert wake.status_code == 201
    fajr = await client.post(
        f"{API}/routine-items",
        json={"title": "Bomdod", "category": "prayer", "prayer_name": "fajr", "time_from_prayer": True,
              "prayer_offset_min": 10},
        headers=h,
    )
    assert fajr.status_code == 201
    # Faqat dam olish kunlari
    weekend = await client.post(
        f"{API}/routine-items",
        json={"title": "Bozor", "category": "custom", "start_time": "10:00", "days_of_week": 96},
        headers=h,
    )

    monday = date(2026, 10, 12)
    day = (await client.get(f"{API}/today?date={monday}", headers=h)).json()
    titles = [i["item"]["title"] for i in day["items"]]
    assert "Bozor" not in titles
    assert titles[0] == "Uyg'onish"
    fajr_entry = next(i for i in day["items"] if i["item"]["title"] == "Bomdod")
    expected = prayer.compute(monday, 41.2995, 69.2401, "Asia/Tashkent")["fajr"]
    got = time.fromisoformat(fajr_entry["time"])
    assert (got.hour * 60 + got.minute) - (expected.hour * 60 + expected.minute) == 10

    sunday = date(2026, 10, 18)
    day = (await client.get(f"{API}/today?date={sunday}", headers=h)).json()
    assert "Bozor" in [i["item"]["title"] for i in day["items"]]

    # Tahrirlash va o'chirish (arxiv)
    wid = weekend.json()["id"]
    res = await client.patch(f"{API}/routine-items/{wid}", json={"title": "Bozorlik"}, headers=h)
    assert res.json()["title"] == "Bozorlik"
    assert (await client.delete(f"{API}/routine-items/{wid}", headers=h)).status_code == 204
    items = (await client.get(f"{API}/routine-items", headers=h)).json()
    assert wid not in [i["id"] for i in items]


async def test_checkins_and_score(client, token):
    h = auth(token)
    await onboard(client, token)
    ids = []
    for title in ("A", "B", "C", "D"):
        res = await client.post(
            f"{API}/routine-items", json={"title": title, "category": "custom", "start_time": "09:00"}, headers=h
        )
        ids.append(res.json()["id"])

    today = (await client.get(f"{API}/today", headers=h)).json()["date"]
    for item_id, status in zip(ids, ("done", "partial", "excused", "missed")):
        res = await client.put(
            f"{API}/checkins", json={"routine_item_id": item_id, "date": today, "status": status}, headers=h
        )
        assert res.status_code == 200, res.text

    summary = (await client.get(f"{API}/today", headers=h)).json()["summary"]
    assert summary == {"planned": 4, "done": 1, "partial": 1, "missed": 1, "excused": 1, "score": 50.0}

    # Uzrli holatda sabab avtomatik "other"
    entry = next(
        i for i in (await client.get(f"{API}/today", headers=h)).json()["items"] if i["item"]["id"] == ids[2]
    )
    assert entry["checkin"]["excuse_reason"] == "other"

    # Upsert — ikkinchi marta yuborilsa yangilanadi, dublikat bo'lmaydi
    res = await client.put(
        f"{API}/checkins", json={"routine_item_id": ids[3], "date": today, "status": "done", "value": 12}, headers=h
    )
    assert res.json()["status"] == "done" and res.json()["value"] == 12
    summary = (await client.get(f"{API}/today", headers=h)).json()["summary"]
    assert summary["done"] == 2 and summary["missed"] == 0

    # Kelajak sanasiga check-in mumkin emas
    future = (date.fromisoformat(today) + timedelta(days=1)).isoformat()
    res = await client.put(
        f"{API}/checkins", json={"routine_item_id": ids[0], "date": future, "status": "done"}, headers=h
    )
    assert res.status_code == 422


async def test_cannot_touch_others_items(client, token):
    item = await client.post(
        f"{API}/routine-items", json={"title": "Meniki", "category": "custom"}, headers=auth(token)
    )
    other = (await register(client, email="vali@example.com"))["tokens"]["access_token"]
    res = await client.patch(
        f"{API}/routine-items/{item.json()['id']}", json={"title": "Seniki"}, headers=auth(other)
    )
    assert res.status_code == 404


async def test_modes(client, token):
    h = auth(token)
    await onboard(client, token)
    mode = (await client.post(
        f"{API}/modes", json={"name": "Imtihon", "type": "exam", "starts_on": "2026-10-20", "ends_on": "2026-10-25"},
        headers=h,
    )).json()
    await client.post(
        f"{API}/routine-items",
        json={"title": "Takrorlash", "category": "study", "start_time": "16:00", "mode_id": mode["id"]},
        headers=h,
    )
    inside = (await client.get(f"{API}/today?date=2026-10-21", headers=h)).json()
    outside = (await client.get(f"{API}/today?date=2026-10-27", headers=h)).json()
    assert "Takrorlash" in [i["item"]["title"] for i in inside["items"]]
    assert "Takrorlash" not in [i["item"]["title"] for i in outside["items"]]

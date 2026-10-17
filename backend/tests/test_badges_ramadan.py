from datetime import date, timedelta

from tests.conftest import auth, register

API = "/api/v1"


async def test_badges_first_step_and_book(client):
    h = auth((await register(client))["tokens"]["access_token"])
    data = (await client.get(f"{API}/badges", headers=h)).json()
    assert data["xp"] == 0 and all(b["earned_at"] is None for b in data["badges"])

    item = (await client.post(f"{API}/routine-items", json={"title": "A", "category": "custom"}, headers=h)).json()
    today = (await client.get(f"{API}/today", headers=h)).json()["date"]
    await client.put(f"{API}/checkins", json={"routine_item_id": item["id"], "date": today, "status": "done"}, headers=h)
    book = (await client.post(f"{API}/books", json={"title": "K", "total_pages": 10}, headers=h)).json()
    await client.post(f"{API}/books/{book['id']}/progress", json={"current_page": 10}, headers=h)

    data = (await client.get(f"{API}/badges", headers=h)).json()
    earned = {b["code"] for b in data["badges"] if b["earned_at"]}
    assert {"first_step", "book_1"} <= earned
    assert set(data["new"]) >= {"first_step", "book_1"}
    assert data["xp"] >= 70
    # Ikkinchi chaqiruvda "yangi" bo'sh
    assert (await client.get(f"{API}/badges", headers=h)).json()["new"] == []


async def test_ramadan_mode(client):
    h = auth((await register(client))["tokens"]["access_token"])
    await client.patch(f"{API}/me/profile", json={"timezone": "Asia/Tashkent", "prays": True}, headers=h)
    today = date.fromisoformat((await client.get(f"{API}/today", headers=h)).json()["date"])
    bad = await client.post(f"{API}/modes/ramadan", json={"starts_on": today.isoformat(), "ends_on": today.isoformat()}, headers=h)
    assert bad.status_code == 422

    start = today - timedelta(days=2)
    res = await client.post(
        f"{API}/modes/ramadan", json={"starts_on": start.isoformat(), "ends_on": (start + timedelta(days=29)).isoformat()}, headers=h
    )
    assert res.status_code == 201
    day = (await client.get(f"{API}/today", headers=h)).json()
    assert day["ramadan"]["day"] == 3
    titles = [e["item"]["title"] for e in day["items"]]
    assert {"Saharlik", "Iftorlik", "Taroveh namozi"} <= set(titles)
    suhoor = next(e for e in day["items"] if e["item"]["title"] == "Saharlik")
    fajr = day["prayer_times"]["fajr"]
    fh, fm = map(int, fajr.split(":")[:2])
    sh, sm = map(int, suhoor["time"].split(":")[:2])
    assert (fh * 60 + fm) - (sh * 60 + sm) == 30

    # Ramazondan tashqarida — yo'q
    after = (start + timedelta(days=40)).isoformat()
    later = (await client.get(f"{API}/today?date={after}", headers=h)).json()
    assert later["ramadan"] is None and "Saharlik" not in [e["item"]["title"] for e in later["items"]]

    # Rejim o'chirilsa — vazifalari ham yo'qoladi (har kunga aylanib qolmaydi)
    mode_id = res.json()["id"]
    await client.delete(f"{API}/modes/{mode_id}", headers=h)
    day = (await client.get(f"{API}/today?date={after}", headers=h)).json()
    assert "Saharlik" not in [e["item"]["title"] for e in day["items"]]

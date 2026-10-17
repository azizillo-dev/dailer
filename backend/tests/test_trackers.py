from tests.conftest import auth, register

API = "/api/v1"


async def user_with_items(client):
    h = auth((await register(client))["tokens"]["access_token"])
    await client.patch(f"{API}/me/profile", json={"timezone": "Asia/Tashkent"}, headers=h)
    reading = await client.post(
        f"{API}/routine-items",
        json={"title": "Kitob o'qish", "category": "reading", "target_value": 20, "unit": "bet"},
        headers=h,
    )
    quran = await client.post(
        f"{API}/routine-items", json={"title": "Qur'on", "category": "quran", "target_value": 2, "unit": "bet"}, headers=h
    )
    return h, reading.json()["id"], quran.json()["id"]


async def checkin_of(client, h, item_id):
    day = (await client.get(f"{API}/today", headers=h)).json()
    return next(e["checkin"] for e in day["items"] if e["item"]["id"] == item_id)


async def test_books_progress_and_auto_checkin(client):
    h, reading_id, _ = await user_with_items(client)
    b = (await client.post(f"{API}/books", json={"title": "Atomic Habits", "total_pages": 300, "current_page": 40}, headers=h)).json()
    assert b["percent"] == 13 and b["status"] == "reading"

    b = (await client.post(f"{API}/books/{b['id']}/progress", json={"current_page": 52}, headers=h)).json()
    assert b["today_pages"] == 12
    c = await checkin_of(client, h, reading_id)
    assert c["status"] == "partial" and c["value"] == 12

    b = (await client.post(f"{API}/books/{b['id']}/progress", json={"current_page": 61}, headers=h)).json()
    assert b["today_pages"] == 21
    c = await checkin_of(client, h, reading_id)
    assert c["status"] == "done" and c["value"] == 21

    b = (await client.post(f"{API}/books/{b['id']}/progress", json={"current_page": 999}, headers=h)).json()
    assert b["status"] == "finished" and b["current_page"] == 300

    lib = (await client.get(f"{API}/books", headers=h)).json()
    assert lib["finished_this_year"] == 1 and lib["pages_this_year"] == 260

    other = auth((await register(client, email="vali@example.com"))["tokens"]["access_token"])
    assert (await client.post(f"{API}/books/{b['id']}/progress", json={"current_page": 1}, headers=other)).status_code == 404


async def test_quran_khatm(client):
    h, _, quran_id = await user_with_items(client)
    q = (await client.get(f"{API}/quran", headers=h)).json()
    assert q["current_page"] == 0 and q["total_pages"] == 604
    await client.patch(f"{API}/quran", json={"current_page": 600}, headers=h)
    q = (await client.post(f"{API}/quran/read", json={"pages": 6}, headers=h)).json()
    assert q["khatm_completed"] is True and q["khatm_count"] == 1 and q["current_page"] == 2
    assert q["today_pages"] == 6
    c = await checkin_of(client, h, quran_id)
    assert c["status"] == "done"


async def test_dhikr_counters(client):
    h = auth((await register(client))["tokens"]["access_token"])
    counters = (await client.get(f"{API}/dhikr", headers=h)).json()
    assert [c["name"] for c in counters][:3] == ["Subhanalloh", "Alhamdulillah", "Allohu akbar"]
    cid = counters[0]["id"]
    await client.post(f"{API}/dhikr/{cid}/add", json={"count": 20}, headers=h)
    r = (await client.post(f"{API}/dhikr/{cid}/add", json={"count": 13}, headers=h)).json()
    assert r["today"] == 33 and r["target"] == 33

    added = (await client.post(f"{API}/dhikr", json={"name": "Salovat", "target": 100}, headers=h)).json()
    assert added[-1]["name"] == "Salovat"
    await client.delete(f"{API}/dhikr/{added[-1]['id']}", headers=h)
    assert "Salovat" not in [c["name"] for c in (await client.get(f"{API}/dhikr", headers=h)).json()]

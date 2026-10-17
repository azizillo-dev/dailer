from datetime import date, timedelta

from tests.conftest import auth, register
from tests.test_content_admin import make_admin

API = "/api/v1"


async def today_of(client, h) -> date:
    return date.fromisoformat((await client.get(f"{API}/today", headers=h)).json()["date"])


async def test_personal_language_challenge(client):
    h = auth((await register(client))["tokens"]["access_token"])
    res = await client.post(
        f"{API}/challenges",
        json={"kind": "language_words", "title": "10 kunda 300 ta inglizcha so'z", "language_code": "en",
              "target_value": 300, "duration_days": 10},
        headers=h,
    )
    assert res.status_code == 201
    c = res.json()
    assert c["unit"] == "so'z" and c["joined"] and c["day"] == 1 and c["expected"] == 30

    today = await today_of(client, h)
    cid = c["id"]
    d = (await client.put(f"{API}/challenges/{cid}/logs", json={"date": today.isoformat(), "value": 40}, headers=h)).json()
    assert d["progress"] == 40 and len(d["logs"]) == 1
    # Shu kun qayta yuborilsa — almashtiriladi, qo'shilmaydi
    d = (await client.put(f"{API}/challenges/{cid}/logs", json={"date": today.isoformat(), "value": 35}, headers=h)).json()
    assert d["progress"] == 35

    # Challenge boshlanishidan oldingi kun — rad
    bad = await client.put(
        f"{API}/challenges/{cid}/logs", json={"date": (today - timedelta(days=1)).isoformat(), "value": 5}, headers=h
    )
    assert bad.status_code == 422

    mine = (await client.get(f"{API}/challenges", headers=h)).json()
    assert [m["id"] for m in mine] == [cid]

    # Boshqa foydalanuvchi shaxsiy challenge'ni ko'rmaydi
    other = auth((await register(client, email="vali@example.com"))["tokens"]["access_token"])
    assert (await client.get(f"{API}/challenges/{cid}", headers=other)).status_code == 404

    # Chiqish — shaxsiy challenge o'chadi
    assert (await client.post(f"{API}/challenges/{cid}/leave", headers=h)).status_code == 204
    assert (await client.get(f"{API}/challenges", headers=h)).json() == []


async def test_completion(client):
    h = auth((await register(client))["tokens"]["access_token"])
    cid = (await client.post(
        f"{API}/challenges", json={"kind": "reading_pages", "title": "Kitob", "target_value": 20, "duration_days": 3},
        headers=h,
    )).json()["id"]
    today = await today_of(client, h)
    d = (await client.put(f"{API}/challenges/{cid}/logs", json={"date": today.isoformat(), "value": 25}, headers=h)).json()
    assert d["completed"] is True and d["unit"] == "bet"


async def test_public_challenge_join_and_leaderboard(client):
    admin = await make_admin(client)
    res = await client.post(
        f"{API}/admin/challenges",
        json={"title": {"uz": "30 kunda 1000 so'z", "ru": "1000 слов за 30 дней"}, "target_value": 1000,
              "unit": "so'z", "duration_days": 30},
        headers=admin,
    )
    assert res.status_code == 201
    cid = res.json()["id"]

    ali = auth((await register(client, email="ali@example.com", name="Ali Valiyev"))["tokens"]["access_token"])
    vali = auth((await register(client, email="vali@example.com", name="Vali"))["tokens"]["access_token"])
    await client.patch(f"{API}/me/profile", json={"privacy": "public"}, headers=vali)

    public = (await client.get(f"{API}/challenges?scope=public", headers=ali)).json()
    assert public[0]["title"] == "30 kunda 1000 so'z" and public[0]["participants"] == 0 and not public[0]["joined"]

    for h, value in ((ali, 50), (vali, 120)):
        assert (await client.post(f"{API}/challenges/{cid}/join", headers=h)).json()["joined"]
        today = await today_of(client, h)
        await client.put(f"{API}/challenges/{cid}/logs", json={"date": today.isoformat(), "value": value}, headers=h)

    board = (await client.get(f"{API}/challenges/{cid}/leaderboard", headers=ali)).json()
    assert [(b["rank"], b["name"], b["progress"]) for b in board] == [(1, "Vali", 120), (2, "Ali", 50)]
    assert board[1]["me"] is True

    # Ruschada sarlavha
    await client.patch(f"{API}/me/profile", json={"language": "ru"}, headers=ali)
    mine = (await client.get(f"{API}/challenges", headers=ali)).json()
    assert mine[0]["title"] == "1000 слов за 30 дней" and mine[0]["participants"] == 2

    # Yopiq profil — reytingda faqat bosh harf
    await client.patch(f"{API}/me/profile", json={"privacy": "private"}, headers=vali)
    board = (await client.get(f"{API}/challenges/{cid}/leaderboard", headers=ali)).json()
    assert board[0]["name"] == "V."

    # Admin o'chirsa — ro'yxatdan yo'qoladi
    await client.patch(f"{API}/admin/challenges/{cid}", json={"is_active": False}, headers=admin)
    assert (await client.get(f"{API}/challenges?scope=public", headers=ali)).json() == []

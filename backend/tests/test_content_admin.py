from datetime import UTC, datetime, timedelta

import pyotp

from app.db.session import SessionLocal
from app.models import Motivation
from app.services.motivations_seed import MOTIVATIONS
from tests.conftest import auth, last_email_token, register

API = "/api/v1"


async def make_admin(client) -> dict:
    """Super admin: tasdiqlangan email + yoqilgan 2FA."""
    data = await register(client, email="boss@dailer.uz")
    await client.post(f"{API}/auth/verify-email", json={"token": last_email_token()})
    h = auth(data["tokens"]["access_token"])
    secret = (await client.post(f"{API}/auth/2fa/setup", headers=h)).json()["secret"]
    await client.post(f"{API}/auth/2fa/confirm", json={"code": pyotp.TOTP(secret).now()}, headers=h)
    return h


async def seed_motivations():
    async with SessionLocal() as db:
        base = datetime.now(UTC)
        for i, m in enumerate(MOTIVATIONS[:5]):
            db.add(Motivation(text=m["text"], category=m["category"], created_at=base + timedelta(seconds=i)))
        await db.commit()


async def test_admin_requires_2fa(client):
    data = await register(client, email="boss@dailer.uz")
    await client.post(f"{API}/auth/verify-email", json={"token": last_email_token()})
    h = auth(data["tokens"]["access_token"])
    # Super admin, lekin 2FA yo'q — admin API yopiq
    assert (await client.get(f"{API}/admin/dashboard", headers=h)).status_code == 403
    user = auth((await register(client, email="ali@example.com"))["tokens"]["access_token"])
    assert (await client.get(f"{API}/admin/dashboard", headers=user)).status_code == 403


async def test_motivation_of_day_and_crud(client):
    await seed_motivations()
    admin = await make_admin(client)
    user = auth((await register(client, email="ali@example.com"))["tokens"]["access_token"])

    first = (await client.get(f"{API}/motivations/today", headers=user)).json()
    assert first["text"]["uz"]
    # Kun uchun bir xil
    assert (await client.get(f"{API}/motivations/today", headers=user)).json()["id"] == first["id"]

    today = (await client.get(f"{API}/today", headers=user)).json()["date"]
    pinned = await client.post(
        f"{API}/admin/motivations",
        json={"text": {"uz": "Bugungi maxsus so'z", "ru": "", "en": "Special"}, "publish_on": today},
        headers=admin,
    )
    assert pinned.status_code == 201
    assert pinned.json()["text"] == {"uz": "Bugungi maxsus so'z", "en": "Special"}
    assert (await client.get(f"{API}/motivations/today", headers=user)).json()["text"]["uz"] == "Bugungi maxsus so'z"

    no_uz = await client.post(f"{API}/admin/motivations", json={"text": {"en": "x"}}, headers=admin)
    assert no_uz.status_code == 422

    mid = pinned.json()["id"]
    await client.patch(f"{API}/admin/motivations/{mid}", json={"is_active": False}, headers=admin)
    assert (await client.get(f"{API}/motivations/today", headers=user)).json()["id"] != mid
    assert (await client.delete(f"{API}/admin/motivations/{mid}", headers=admin)).status_code == 204

    feed = (await client.get(f"{API}/motivations?category=discipline", headers=user)).json()
    assert feed and all(m["category"] == "discipline" for m in feed)


async def test_banners_targeting_and_stats(client):
    admin = await make_admin(client)
    ali = (await register(client, email="ali@example.com"))["tokens"]["access_token"]
    user = auth(ali)
    await client.patch(f"{API}/me/profile", json={"user_type": "school_pupil"}, headers=user)

    def banner(**kw):
        return {"title": {"uz": kw.pop("t", "Yangilik")}, **kw}

    await client.post(f"{API}/admin/banners", json=banner(t="Hammaga", priority=1), headers=admin)
    await client.post(f"{API}/admin/banners", json=banner(t="Talabalarga", audience={"user_types": ["university_student"]}), headers=admin)
    await client.post(f"{API}/admin/banners", json=banner(t="Ruslarga", audience={"languages": ["ru"]}), headers=admin)
    await client.post(
        f"{API}/admin/banners",
        json=banner(t="Tugagan", starts_at=(datetime.now(UTC) - timedelta(days=3)).isoformat(),
                    ends_at=(datetime.now(UTC) - timedelta(days=1)).isoformat()),
        headers=admin,
    )
    pupils = await client.post(
        f"{API}/admin/banners", json=banner(t="O'quvchilarga", audience={"user_types": ["school_pupil"]}, priority=5),
        headers=admin,
    )
    bad = await client.post(f"{API}/admin/banners", json=banner(link_url="javascript:alert(1)"), headers=admin)
    assert bad.status_code == 422

    shown = [b["title"]["uz"] for b in (await client.get(f"{API}/banners", headers=user)).json()]
    assert shown == ["O'quvchilarga", "Hammaga"]

    bid = pupils.json()["id"]
    await client.post(
        f"{API}/banners/events",
        json={"events": [{"banner_id": bid, "event": "impression"}] * 4 + [{"banner_id": bid, "event": "click"}]},
        headers=user,
    )
    stats = (await client.get(f"{API}/admin/banners/{bid}/stats", headers=admin)).json()
    assert stats["impressions"] == 4 and stats["clicks"] == 1 and stats["ctr"] == 25.0
    assert stats["unique_viewers"] == 1

    logs = (await client.get(f"{API}/admin/audit-logs", headers=admin)).json()
    assert any(log["action"] == "banner.create" and log["actor"] == "boss@dailer.uz" for log in logs)


async def test_admin_users_management(client):
    admin = await make_admin(client)
    ali = await register(client, email="ali@example.com")
    users = (await client.get(f"{API}/admin/users?q=ali@", headers=admin)).json()
    assert users["total"] == 1
    uid = users["items"][0]["id"]

    res = await client.patch(f"{API}/admin/users/{uid}", json={"status": "blocked"}, headers=admin)
    assert res.json()["status"] == "blocked"
    # Bloklangan foydalanuvchi kira olmaydi, sessiyasi yopilgan
    assert (await client.get(f"{API}/me", headers=auth(ali["tokens"]["access_token"]))).status_code == 403
    login = await client.post(f"{API}/auth/login", json={"email": "ali@example.com", "password": "Parol1234"})
    assert login.status_code == 403

    # Super admin tayinlab bo'lmaydi; o'zini o'zgartira olmaydi
    assert (await client.patch(f"{API}/admin/users/{uid}", json={"role": "super_admin"}, headers=admin)).status_code == 403
    me = (await client.get(f"{API}/me", headers=admin)).json()
    assert (await client.patch(f"{API}/admin/users/{me['id']}", json={"status": "blocked"}, headers=admin)).status_code == 403

    dash = (await client.get(f"{API}/admin/dashboard", headers=admin)).json()
    assert dash["users_total"] == 2 and len(dash["series"]) == 14

import json
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import update

from app.db.session import SessionLocal
from app.models import RoutineItem, User, UserStatus
from app.services import jobs, notify
from tests.conftest import auth, register

API = "/api/v1"
TZ = ZoneInfo("Asia/Tashkent")

SUB = json.dumps({"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "x" * 20, "auth": "y" * 10}})


async def onboarded(client, email="ali@example.com", **profile):
    h = auth((await register(client, email=email))["tokens"]["access_token"])
    body = {
        "user_type": "university_student", "birth_year": 2004, "wake_time": "05:00", "sleep_time": "23:00",
        "prays": False, "main_goal": "Dasturchi bo'lish", "timezone": "Asia/Tashkent",
        "evening_summary_time": "21:30", **profile,
    }
    assert (await client.post(f"{API}/me/onboarding", json=body, headers=h)).status_code == 200
    return h


def at(local_h: int, local_m: int, days_ago: int = 0) -> datetime:
    d = datetime.now(TZ).date() - timedelta(days=days_ago)
    return datetime(d.year, d.month, d.day, local_h, local_m, tzinfo=TZ).astimezone(UTC)


async def test_device_registration_and_inbox(client):
    h = await onboarded(client)
    bad = await client.post(f"{API}/me/devices", json={"platform": "web", "push_token": "not-json-subscription"}, headers=h)
    assert bad.status_code == 422
    ok = await client.post(f"{API}/me/devices", json={"platform": "web", "push_token": SUB}, headers=h)
    assert ok.status_code == 200

    notify.sent.clear()
    # Kechki xulosa: 2 vazifadan 1 tasi bajarilgan
    ids = []
    for title in ("Kitob o'qish", "Sport"):
        r = await client.post(f"{API}/routine-items", json={"title": title, "category": "custom", "start_time": "09:00"}, headers=h)
        ids.append(r.json()["id"])
    today = (await client.get(f"{API}/today", headers=h)).json()["date"]
    await client.put(f"{API}/checkins", json={"routine_item_id": ids[0], "date": today, "status": "done"}, headers=h)

    async with SessionLocal() as db:
        assert (await jobs.evening_summaries(db, at(21, 29))) == 0  # vaqti emas
        assert (await jobs.evening_summaries(db, at(21, 30))) == 1
        assert (await jobs.evening_summaries(db, at(21, 30))) == 0  # bir kunda bir marta

    assert len(notify.sent) == 1
    assert notify.sent[0]["title"] == "Bugungi kun xulosasi"
    assert "1/2" in notify.sent[0]["body"] and "Sport" in notify.sent[0]["body"]

    inbox = (await client.get(f"{API}/notifications", headers=h)).json()
    assert len(inbox) == 1 and inbox[0]["kind"] == "evening_summary" and inbox[0]["read"] is False
    assert (await client.get(f"{API}/notifications/unread-count", headers=h)).json()["count"] == 1
    await client.post(f"{API}/notifications/{inbox[0]['id']}/read", headers=h)
    assert (await client.get(f"{API}/notifications/unread-count", headers=h)).json()["count"] == 0


async def test_all_done_and_russian(client):
    h = await onboarded(client, language="ru")
    r = await client.post(f"{API}/routine-items", json={"title": "Чтение", "category": "custom"}, headers=h)
    today = (await client.get(f"{API}/today", headers=h)).json()["date"]
    await client.put(f"{API}/checkins", json={"routine_item_id": r.json()["id"], "date": today, "status": "done"}, headers=h)
    async with SessionLocal() as db:
        await jobs.evening_summaries(db, at(21, 30))
    inbox = (await client.get(f"{API}/notifications", headers=h)).json()
    assert inbox[0]["title"] == "Итоги дня" and "всё выполнено" in inbox[0]["body"]


async def test_goal_reminder_frequency(client):
    h = await onboarded(client, goal_reminder_freq="daily")
    async with SessionLocal() as db:
        assert await jobs.goal_reminders(db, at(5, 30)) == 1  # uyg'onishdan 30 daqiqa keyin
    inbox = (await client.get(f"{API}/notifications", headers=h)).json()
    assert inbox[0]["title"] == "Don't forget why you started!" and inbox[0]["body"] == "Dasturchi bo'lish"

    await client.patch(f"{API}/me/profile", json={"goal_reminder_freq": "off"}, headers=h)
    async with SessionLocal() as db:
        assert await jobs.goal_reminders(db, at(5, 30) + timedelta(days=1)) == 0


async def test_never_miss_twice(client):
    h = await onboarded(client)
    r = await client.post(f"{API}/routine-items", json={"title": "Kitob", "category": "reading"}, headers=h)
    async with SessionLocal() as db:
        await db.execute(
            update(RoutineItem).where(RoutineItem.id == r.json()["id"]).values(created_at=datetime.now(UTC) - timedelta(days=5))
        )
        await db.commit()
        # Kecha hech narsa belgilanmagan → ertalab eslatma
        assert await jobs.never_miss_twice(db, at(5, 10)) == 1
    inbox = (await client.get(f"{API}/notifications", headers=h)).json()
    assert inbox[0]["kind"] == "never_miss_twice"


async def test_purge_deleted_accounts(client):
    h = await onboarded(client)
    await client.delete(f"{API}/me", headers=h)
    async with SessionLocal() as db:
        assert await jobs.purge_deleted_accounts(db, datetime.now(UTC)) == 0  # 30 kun o'tmagan
        await db.execute(
            update(User).where(User.status == UserStatus.pending_deletion)
            .values(deletion_requested_at=datetime.now(UTC) - timedelta(days=31))
        )
        await db.commit()
        assert await jobs.purge_deleted_accounts(db, datetime.now(UTC)) == 1
    res = await client.post(f"{API}/auth/login", json={"email": "ali@example.com", "password": "Parol1234"})
    assert res.status_code == 401

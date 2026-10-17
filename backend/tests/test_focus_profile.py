import io
import uuid
from datetime import UTC, datetime, timedelta

from PIL import Image

from tests.conftest import auth, register

API = "/api/v1"


async def test_pomodoro_sessions(client):
    h = auth((await register(client))["tokens"]["access_token"])
    start = datetime.now(UTC) - timedelta(minutes=30)
    cid = str(uuid.uuid4())
    body = {
        "planned_min": 25, "actual_min": 25, "started_at": start.isoformat(),
        "ended_at": (start + timedelta(minutes=25)).isoformat(), "client_id": cid,
    }
    first = await client.post(f"{API}/pomodoro/sessions", json=body, headers=h)
    assert first.status_code == 201
    # Takroriy yuborish — dublikat yaratmaydi
    again = await client.post(f"{API}/pomodoro/sessions", json=body, headers=h)
    assert again.json()["id"] == first.json()["id"]

    await client.post(f"{API}/pomodoro/sessions", json={**body, "client_id": None, "actual_min": 10, "completed": False}, headers=h)
    await client.post(f"{API}/pomodoro/sessions", json={**body, "client_id": None, "kind": "short_break", "planned_min": 5, "actual_min": 5}, headers=h)

    stats = (await client.get(f"{API}/pomodoro/stats", headers=h)).json()
    assert stats["total_minutes"] == 35  # tanaffus hisoblanmaydi
    assert stats["total_sessions"] == 1  # faqat tugallangan fokus
    assert len(stats["today"]) == 3

    bad = await client.post(
        f"{API}/pomodoro/sessions",
        json={**body, "client_id": None, "ended_at": (start - timedelta(minutes=1)).isoformat()},
        headers=h,
    )
    assert bad.status_code == 422


def _png(w=800, h=600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (192, 133, 82)).save(buf, "PNG")
    return buf.getvalue()


async def test_avatar_upload_and_delete(client, tmp_path, monkeypatch):
    from app.services import uploads

    monkeypatch.setattr(uploads, "ROOT", tmp_path)
    h = auth((await register(client))["tokens"]["access_token"])

    res = await client.post(f"{API}/me/avatar", files={"file": ("a.png", _png(), "image/png")}, headers=h)
    assert res.status_code == 200, res.text
    url = res.json()["profile"]["avatar_url"]
    assert url.endswith(".webp")
    saved = list((tmp_path / "avatars").iterdir())
    assert len(saved) == 1
    assert Image.open(saved[0]).size == (320, 320)

    bad = await client.post(f"{API}/me/avatar", files={"file": ("a.png", b"not an image", "image/png")}, headers=h)
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "invalid_image"

    res = await client.delete(f"{API}/me/avatar", headers=h)
    assert res.json()["profile"]["avatar_url"] is None
    assert list((tmp_path / "avatars").iterdir()) == []


async def test_delete_account_and_restore_by_login(client):
    data = await register(client)
    h = auth(data["tokens"]["access_token"])
    assert (await client.delete(f"{API}/me", headers=h)).status_code == 200
    # Sessiyalar yopilgan
    res = await client.post(f"{API}/auth/refresh", json={"refresh_token": data["tokens"]["refresh_token"]})
    assert res.status_code == 401
    # 30 kun ichida kirsa — tiklanadi
    res = await client.post(f"{API}/auth/login", json={"email": "ali@example.com", "password": "Parol1234"})
    assert res.status_code == 200
    me = (await client.get(f"{API}/me", headers=auth(res.json()["tokens"]["access_token"]))).json()
    assert me["email"] == "ali@example.com"

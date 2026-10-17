"""Bepul hostingga moslashuvlar: Redis'siz rejim, bazadagi rasmlar, tashqi cron, Brevo, Neon URL."""

import io

import httpx
from PIL import Image

from app.core.config import Settings, settings
from app.db.session import SessionLocal
from app.models import StoredFile
from app.services.redis import MemoryRedis
from tests.conftest import auth, register

API = "/api/v1"


async def test_memory_redis_semantics():
    r = MemoryRedis()
    assert await r.incr("a") == 1 and await r.incr("a") == 2
    assert await r.ttl("a") == -1
    await r.expire("a", 60)
    assert 0 < await r.ttl("a") <= 60
    assert await r.set("n", "1", nx=True, ex=10) is True
    assert await r.set("n", "2", nx=True) is None  # bor — yozilmaydi
    assert await r.get("n") == "1"
    await r.set("gone", "x", ex=1)
    r._data["gone"] = ("x", 0)  # muddati o'tgan
    assert await r.get("gone") is None and await r.ttl("gone") == -2
    assert await r.delete("a", "n", "missing") == 2


def test_database_url_normalized():
    s = Settings(database_url="postgresql://u:p@ep-x.neon.tech/db?sslmode=require&channel_binding=require")
    assert s.database_url == "postgresql+asyncpg://u:p@ep-x.neon.tech/db?ssl=require"
    s = Settings(database_url="postgres://u:p@host:5432/db")
    assert s.database_url == "postgresql+asyncpg://u:p@host:5432/db"
    local = "postgresql+asyncpg://dailer:dailer@localhost:5433/dailer"
    assert Settings(database_url=local).database_url == local


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (400, 300), (120, 80, 50)).save(buf, "PNG")
    return buf.getvalue()


async def test_avatar_in_database(client, monkeypatch):
    from app.api.routes.system import stored_file

    monkeypatch.setattr(settings, "upload_storage", "db")
    h = auth((await register(client))["tokens"]["access_token"])
    res = await client.post(f"{API}/me/avatar", files={"file": ("a.png", _png(), "image/png")}, headers=h)
    assert res.status_code == 200, res.text
    url = res.json()["profile"]["avatar_url"]
    rel = url.split("/uploads/", 1)[1]
    async with SessionLocal() as db:
        f = await db.get(StoredFile, rel)
        assert f and f.content_type == "image/webp"
        resp = await stored_file(rel, db)
        assert resp.body[:4] == b"RIFF" and "immutable" in resp.headers["cache-control"]

    # Yangi avatar — eskisi bazadan o'chadi
    await client.post(f"{API}/me/avatar", files={"file": ("b.png", _png(), "image/png")}, headers=h)
    async with SessionLocal() as db:
        assert await db.get(StoredFile, rel) is None
    await client.delete(f"{API}/me/avatar", headers=h)
    async with SessionLocal() as db:
        from sqlalchemy import func, select

        assert await db.scalar(select(func.count()).select_from(StoredFile)) == 0


async def test_cron_endpoint(client, monkeypatch):
    # Kalit sozlanmagan — endpoint yo'qdek
    assert (await client.post(f"{API}/internal/cron/tick")).status_code == 404
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    assert (await client.post(f"{API}/internal/cron/tick", headers={"X-Cron-Secret": "wrong"})).status_code == 404
    res = await client.post(f"{API}/internal/cron/tick", headers={"X-Cron-Secret": "s3cret"})
    assert res.status_code == 200 and set(res.json()) >= {"evening", "goal"}
    res = await client.post(f"{API}/internal/cron/daily", headers={"X-Cron-Secret": "s3cret"})
    assert res.json() == {"purged": 0}


async def test_brevo_provider(monkeypatch):
    from app.services import email as mailer

    sent = {}

    def handler(request: httpx.Request) -> httpx.Response:
        sent["url"] = str(request.url)
        sent["key"] = request.headers["api-key"]
        sent["json"] = __import__("json").loads(request.content)
        return httpx.Response(201, json={"messageId": "x"})

    real = httpx.AsyncClient
    monkeypatch.setattr(mailer.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "email_provider", "brevo")
    monkeypatch.setattr(settings, "brevo_api_key", "key-123")
    monkeypatch.setattr(settings, "mail_from", "Dailer <me@gmail.com>")
    await mailer.send_template("reset_password", "ali@example.com", "uz", "Ali", "https://dailer.uz/reset?token=t")
    assert sent["url"] == "https://api.brevo.com/v3/smtp/email" and sent["key"] == "key-123"
    assert sent["json"]["sender"] == {"name": "Dailer", "email": "me@gmail.com"}
    assert sent["json"]["to"] == [{"email": "ali@example.com"}]
    assert "token=t" in sent["json"]["htmlContent"]

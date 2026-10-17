import json

import httpx
import pytest

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import AIProvider
from app.services.ai import fallback
from app.services.ai import router as ai_router
from app.services.ai.providers_seed import PROVIDERS
from app.services.redis import redis
from tests.conftest import auth, register

API = "/api/v1"


@pytest.fixture
async def providers(monkeypatch):
    async with SessionLocal() as db:
        for p in PROVIDERS:
            db.add(AIProvider(**p))
        await db.commit()
    # Faqat gemini va groq kaliti bor
    monkeypatch.setattr(settings, "gemini_api_key", "g-key")
    monkeypatch.setattr(settings, "groq_api_key", "q-key")
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    monkeypatch.setattr(settings, "deepseek_api_key", "")
    yield
    ai_router.transport = None


def sse(*tokens: str) -> bytes:
    lines = [
        "data: " + json.dumps({"choices": [{"delta": {"content": t}}]}) for t in tokens
    ]
    return ("\n\n".join(lines) + "\n\ndata: [DONE]\n\n").encode()


def parse_events(text: str) -> list[tuple[str, dict]]:
    out = []
    for block in text.strip().split("\n\n"):
        ev, data = None, None
        for line in block.splitlines():
            if line.startswith("event: "):
                ev = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
        if ev:
            out.append((ev, data))
    return out


async def test_chat_streams_and_falls_back_to_next_provider(client, providers):
    calls = []

    def handler(request: httpx.Request):
        calls.append(request.url.host)
        body = json.loads(request.content)
        assert body["stream"] is True and body["messages"][0]["role"] == "system"
        if "groq" in request.url.host:
            # gpt-oss — fikrlash tokenlari tejaladi
            assert body["reasoning_effort"] == "low"
            return httpx.Response(429, json={"error": {"message": "Resource exhausted: quota per day"}})
        return httpx.Response(200, content=sse("Zo'r ", "ketyapsiz!"), headers={"content-type": "text/event-stream"})

    ai_router.transport = httpx.MockTransport(handler)
    h = auth((await register(client))["tokens"]["access_token"])

    res = await client.post(f"{API}/ai/chat", json={"message": "Qanday ketyapman?"}, headers=h)
    assert res.status_code == 200
    events = parse_events(res.text)
    assert events[0][0] == "meta"
    text = "".join(d["t"] for e, d in events if e == "token")
    assert text == "Zo'r ketyapsiz!"
    assert events[-1] == ("done", {"message_id": events[-1][1]["message_id"], "provider": "gemini"})
    assert calls == ["api.groq.com", "generativelanguage.googleapis.com"]

    # Groq kunlik kvota tugagani uchun cooldown'da — keyingi so'rov to'g'ri Gemini'ga
    assert await redis.ttl("ai:cooldown:groq") > 3000
    calls.clear()
    conv_id = events[0][1]["conversation_id"]
    await client.post(f"{API}/ai/chat", json={"message": "Rahmat", "conversation_id": conv_id}, headers=h)
    assert calls == ["generativelanguage.googleapis.com"]

    usage = (await client.get(f"{API}/ai/usage", headers=h)).json()
    assert usage["used"] == 2 and usage["limit"] == 15

    conv = (await client.get(f"{API}/ai/conversations/{conv_id}", headers=h)).json()
    assert [m["role"] for m in conv["messages"]] == ["user", "assistant", "user", "assistant"]


async def test_template_fallback_when_all_fail(client, providers):
    ai_router.transport = httpx.MockTransport(lambda r: httpx.Response(503, text="down"))
    h = auth((await register(client))["tokens"]["access_token"])
    res = await client.post(f"{API}/ai/chat", json={"message": "Qanday ketyapman?"}, headers=h)
    events = parse_events(res.text)
    text = "".join(d["t"] for e, d in events if e == "token")
    assert "yetarli ma'lumot yo'q" in text  # yangi foydalanuvchi — statistikasi yo'q
    assert events[-1][1]["provider"] == "template"
    # Shablon javob limitni sarflamaydi
    assert (await client.get(f"{API}/ai/usage", headers=h)).json()["used"] == 0


async def test_daily_limit(client, providers):
    ai_router.transport = httpx.MockTransport(
        lambda r: httpx.Response(200, content=sse("ok"), headers={"content-type": "text/event-stream"})
    )
    data = await register(client)
    h = auth(data["tokens"]["access_token"])
    me = (await client.get(f"{API}/me", headers=h)).json()
    today = (await client.get(f"{API}/today", headers=h)).json()["date"]
    await redis.set(f"ai:user:{me['id']}:{today}", 15)
    res = await client.post(f"{API}/ai/chat", json={"message": "salom"}, headers=h)
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "ai_limit_reached"


async def test_weekly_report_once_per_week(client, providers):
    ai_router.transport = httpx.MockTransport(
        lambda r: httpx.Response(200, content=sse("Hisobot ", "matni."), headers={"content-type": "text/event-stream"})
    )
    h = auth((await register(client))["tokens"]["access_token"])
    first = await client.post(f"{API}/ai/reports/weekly", headers=h)
    assert first.status_code == 201
    assert first.json()["content"] == "Hisobot matni."
    second = await client.post(f"{API}/ai/reports/weekly", headers=h)
    assert second.status_code == 200 and second.json()["id"] == first.json()["id"]
    assert len((await client.get(f"{API}/ai/reports", headers=h)).json()) == 1


def test_fallback_analysis_text():
    ctx = {
        "last_7_days": {"score": 72, "prev_7_days_score": 60, "by_category": {"prayer": 95, "reading": 40}},
        "most_missed": [{"title": "Kitob o'qish", "missed_days": 4, "usual_time": "05:45"}],
        "streak": {"current": 5},
    }
    text = fallback.analysis(ctx, "uz", note=False)
    assert "72%" in text and "12 ball yuqori" in text
    assert "namoz (95%)" in text and "kitob o'qish (40%)" in text
    assert "Kitob o'qish" in text and "05:45" in text
    assert "5 kun" in text
    assert "72%" in fallback.analysis(ctx, "ru") and "Kitob o'qish" in fallback.analysis(ctx, "en")


async def test_admin_providers(client, providers):
    from tests.test_content_admin import make_admin

    admin = await make_admin(client)
    rows = (await client.get(f"{API}/admin/ai/providers", headers=admin)).json()
    assert [r["code"] for r in rows] == ["groq", "gemini", "openrouter", "deepseek", "grok"]
    assert rows[0]["has_key"] is True and rows[2]["has_key"] is False
    res = await client.patch(
        f"{API}/admin/ai/providers/{rows[1]['id']}", json={"priority": 5, "model": "gemini-flash-latest"}, headers=admin
    )
    assert res.json()["priority"] == 5
    rows = (await client.get(f"{API}/admin/ai/providers", headers=admin)).json()
    assert rows[0]["code"] == "gemini"

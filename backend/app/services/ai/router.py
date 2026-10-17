"""AI provayderlar zanjiri.

- Barcha provayderlar OpenAI-mos `/chat/completions` (stream) orqali chaqiriladi.
- Birinchi token kelguncha xato bo'lsa — keyingi provayderga o'tiladi.
- 429/kvota → cooldown; ketma-ket 5xx/timeout → qisqa cooldown; noto'g'ri kalit → uzoq cooldown.
- Holat Redis'da: ai:cooldown:{code}, ai:fail:{code}, ai:count:{code}:{sana}.
"""

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import AIProvider
from app.services.redis import redis

log = logging.getLogger(__name__)

FIRST_TOKEN_TIMEOUT = 12.0
# Testlar o'z transportini qo'yadi
transport: httpx.AsyncBaseTransport | None = None


class ProviderError(Exception):
    def __init__(self, kind: str, retry_after: int | None = None):
        super().__init__(kind)
        self.kind = kind  # rate_limit | quota | auth | server | timeout | bad_response
        self.retry_after = retry_after


@dataclass
class Start:
    provider: str
    model: str
    level: int


def api_key(p: AIProvider) -> str:
    return getattr(settings, p.api_key_env.lower(), "") or ""


def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


async def cooldown_left(code: str) -> int:
    ttl = await redis.ttl(f"ai:cooldown:{code}")
    return max(ttl, 0)


async def today_count(code: str) -> int:
    return int(await redis.get(f"ai:count:{code}:{_today()}") or 0)


async def usable_providers(db: AsyncSession) -> list[AIProvider]:
    rows = (await db.scalars(select(AIProvider).where(AIProvider.enabled.is_(True)).order_by(AIProvider.priority))).all()
    out = []
    for p in rows:
        if not api_key(p):
            continue
        if await cooldown_left(p.code):
            continue
        if p.daily_request_cap is not None and await today_count(p.code) >= p.daily_request_cap:
            continue
        out.append(p)
    return out


async def _penalize(code: str, err: ProviderError) -> None:
    if err.kind in ("rate_limit",):
        seconds = err.retry_after or 60
    elif err.kind == "quota":
        seconds = 3600
    elif err.kind == "auth":
        seconds = 3600
    else:
        fails = await redis.incr(f"ai:fail:{code}")
        await redis.expire(f"ai:fail:{code}", 300)
        if fails < 3:
            return
        seconds = 300
    await redis.set(f"ai:cooldown:{code}", err.kind, ex=max(1, min(seconds, 86400)))
    log.warning("AI provider %s cooldown %ss (%s)", code, seconds, err.kind)


def _classify(resp: httpx.Response, body: str) -> ProviderError:
    if resp.status_code == 429:
        low = body.lower()
        if "quota" in low or "per day" in low or "daily" in low or "exhausted" in low:
            return ProviderError("quota")
        ra = resp.headers.get("retry-after")
        return ProviderError("rate_limit", int(float(ra)) if ra and ra.replace(".", "").isdigit() else None)
    if resp.status_code in (401, 403):
        return ProviderError("auth")
    if resp.status_code == 402:
        return ProviderError("quota")
    return ProviderError("server")


async def _stream_one(p: AIProvider, messages: list[dict], max_tokens: int) -> AsyncIterator[str]:
    url = f"{p.base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key(p)}", "Content-Type": "application/json"}
    if p.code == "openrouter":
        headers["HTTP-Referer"] = settings.web_url
        headers["X-Title"] = "Dailer"
    payload = {"model": p.model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.6, "stream": True}
    if "gpt-oss" in p.model:
        # Fikrlash tokenlari max_tokens'ga kiradi — qisqa javoblar uchun past daraja yetarli va tez
        payload["reasoning_effort"] = "low"

    timeout = httpx.Timeout(settings.ai_timeout_seconds, connect=8.0)
    async with httpx.AsyncClient(timeout=timeout, transport=transport) as client:
        try:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread()).decode(errors="ignore")[:500]
                    raise _classify(resp, body)
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if "error" in chunk:
                        raise ProviderError("server")
                    for choice in chunk.get("choices") or []:
                        text = (choice.get("delta") or {}).get("content")
                        if text:
                            yield text
        except httpx.TimeoutException as exc:
            raise ProviderError("timeout") from exc
        except httpx.HTTPError as exc:
            raise ProviderError("server") from exc


async def stream_chat(db: AsyncSession, messages: list[dict], max_tokens: int) -> AsyncIterator[Start | str]:
    """Birinchi muvaffaqiyatli provayderdan oqim. Hech biri ishlamasa — hech narsa yubormaydi
    (chaqiruvchi shablon javobga o'tadi)."""
    providers = await usable_providers(db)
    for level, p in enumerate(providers):
        gen = _stream_one(p, messages, max_tokens)
        started = time.monotonic()
        try:
            first = await asyncio.wait_for(gen.__anext__(), timeout=FIRST_TOKEN_TIMEOUT)
        except StopAsyncIteration:
            await _penalize(p.code, ProviderError("bad_response"))
            continue
        except TimeoutError:
            await gen.aclose()
            await _penalize(p.code, ProviderError("timeout"))
            continue
        except ProviderError as err:
            await gen.aclose()
            await _penalize(p.code, err)
            continue

        await redis.incr(f"ai:count:{p.code}:{_today()}")
        await redis.expire(f"ai:count:{p.code}:{_today()}", 2 * 86400)
        await redis.delete(f"ai:fail:{p.code}")
        log.info("AI %s first token in %.2fs", p.code, time.monotonic() - started)
        yield Start(provider=p.code, model=p.model, level=level)
        yield first
        try:
            async for token in gen:
                yield token
        except ProviderError:
            # Javob yarmida uzildi — borini qoldiramiz
            return
        return


async def complete(db: AsyncSession, messages: list[dict], max_tokens: int) -> tuple[str, Start] | None:
    parts: list[str] = []
    start: Start | None = None
    async for piece in stream_chat(db, messages, max_tokens):
        if isinstance(piece, Start):
            start = piece
        else:
            parts.append(piece)
    if start is None:
        return None
    return "".join(parts).strip(), start

import time

from redis.asyncio import Redis

from app.core.config import settings
from app.core.errors import AppError


class MemoryRedis:
    """Redis'siz ishlash uchun (bitta jarayon): faqat ilovada ishlatiladigan buyruqlar.

    Bepul hostingda Redis'ning oylik buyruq limiti tez tugaydi; bitta server bo'lsa bu yetarli.
    """

    def __init__(self) -> None:
        self._data: dict[str, tuple[str, float | None]] = {}

    def _alive(self, key: str) -> tuple[str, float | None] | None:
        item = self._data.get(key)
        if item and item[1] is not None and item[1] <= time.monotonic():
            del self._data[key]
            return None
        return item

    async def get(self, key: str) -> str | None:
        item = self._alive(key)
        return item[0] if item else None

    async def set(self, key: str, value, ex: int | None = None, nx: bool = False) -> bool | None:
        if nx and self._alive(key):
            return None
        self._data[key] = (str(value), time.monotonic() + ex if ex else None)
        return True

    async def incr(self, key: str) -> int:
        item = self._alive(key)
        n = int(item[0]) + 1 if item else 1
        self._data[key] = (str(n), item[1] if item else None)
        return n

    async def expire(self, key: str, seconds: int) -> bool:
        item = self._alive(key)
        if not item:
            return False
        self._data[key] = (item[0], time.monotonic() + seconds)
        return True

    async def ttl(self, key: str) -> int:
        item = self._alive(key)
        if not item:
            return -2
        return -1 if item[1] is None else max(0, int(item[1] - time.monotonic()))

    async def delete(self, *keys: str) -> int:
        return sum(1 for k in keys if self._data.pop(k, None) is not None)

    async def flushdb(self) -> bool:
        self._data.clear()
        return True


redis = Redis.from_url(settings.redis_url, decode_responses=True) if settings.redis_url else MemoryRedis()


async def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Oddiy oyna (fixed window) limiti. Oshib ketsa — 429."""
    full_key = f"rl:{key}"
    count = await redis.incr(full_key)
    if count == 1:
        await redis.expire(full_key, window_seconds)
    if count > limit:
        raise AppError("rate_limited", 429)

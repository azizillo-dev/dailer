from redis.asyncio import Redis

from app.core.config import settings
from app.core.errors import AppError

redis = Redis.from_url(settings.redis_url, decode_responses=True)


async def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    """Oddiy oyna (fixed window) limiti. Oshib ketsa — 429."""
    full_key = f"rl:{key}"
    count = await redis.incr(full_key)
    if count == 1:
        await redis.expire(full_key, window_seconds)
    if count > limit:
        raise AppError("rate_limited", 429)

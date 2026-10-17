"""Fon vazifalari uchun ARQ worker.

    arq app.worker.WorkerSettings
"""

import logging
from datetime import UTC, datetime

from arq import cron
from arq.connections import RedisSettings

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import jobs

log = logging.getLogger(__name__)


async def tick(ctx) -> dict:
    async with SessionLocal() as db:
        result = await jobs.minute_tick(db)
    if any(result.values()):
        log.info("tick: %s", result)
    return result


async def daily(ctx) -> int:
    async with SessionLocal() as db:
        return await jobs.purge_deleted_accounts(db, datetime.now(UTC))


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    cron_jobs = [
        cron(tick, second=0, run_at_startup=False, unique=True, timeout=55),
        cron(daily, hour=3, minute=0, second=0, unique=True),
    ]
    functions: list = []

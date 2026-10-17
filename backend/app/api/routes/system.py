import hmac
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Header, Response

from app.api.deps import DB
from app.core.config import settings
from app.core.errors import AppError
from app.models import StoredFile
from app.services import jobs

files_router = APIRouter(tags=["system"])
router = APIRouter(prefix="/internal", tags=["system"])


@files_router.get("/uploads/{path:path}")
async def stored_file(path: str, db: DB):
    """UPLOAD_STORAGE=db: rasmlar bazadan. Nomi tasodifiy va o'zgarmas — uzoq keshlanadi."""
    f = await db.get(StoredFile, path)
    if f is None:
        raise AppError("not_found", 404)
    return Response(f.data, media_type=f.content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.post("/cron/{job}")
async def cron(job: Literal["tick", "daily"], db: DB, x_cron_secret: str = Header(default="")):
    """ARQ worker o'rniga — tashqi cron (cron-job.org) har daqiqada "tick", kuniga bir marta "daily" chaqiradi.

    Bepul hostingda alohida worker jarayoni bo'lmaydi; bildirishnomalar dedupe bilan yuboriladi,
    shuning uchun takroriy chaqiruv xavfsiz.
    """
    if not settings.cron_secret or not hmac.compare_digest(x_cron_secret, settings.cron_secret):
        raise AppError("not_found", 404)
    if job == "tick":
        return await jobs.minute_tick(db)
    return {"purged": await jobs.purge_deleted_accounts(db, datetime.now(UTC))}

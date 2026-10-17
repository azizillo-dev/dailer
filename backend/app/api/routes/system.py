import hmac
from datetime import UTC, datetime
from typing import Literal

import jwt
from fastapi import APIRouter, Header, Response
from fastapi.concurrency import run_in_threadpool

from app.api.deps import DB
from app.core.config import settings
from app.core.errors import AppError
from app.models import StoredFile
from app.services import jobs

GITHUB_ISSUER = "https://token.actions.githubusercontent.com"
CRON_AUDIENCE = "dailer-cron"
_jwks: jwt.PyJWKClient | None = None

files_router = APIRouter(tags=["system"])
router = APIRouter(prefix="/internal", tags=["system"])


@files_router.get("/uploads/{path:path}")
async def stored_file(path: str, db: DB):
    """UPLOAD_STORAGE=db: rasmlar bazadan. Nomi tasodifiy va o'zgarmas — uzoq keshlanadi."""
    f = await db.get(StoredFile, path)
    if f is None:
        raise AppError("not_found", 404)
    return Response(f.data, media_type=f.content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})


def _github_oidc_ok(token: str) -> bool:
    """GitHub Actions OIDC tokeni: imzo (GitHub JWKS), audience va aynan bizning repo."""
    global _jwks
    if not settings.cron_github_repo or not token:
        return False
    try:
        _jwks = _jwks or jwt.PyJWKClient(f"{GITHUB_ISSUER}/.well-known/jwks")
        key = _jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=CRON_AUDIENCE, issuer=GITHUB_ISSUER)
    except Exception:
        return False
    return claims.get("repository") == settings.cron_github_repo and claims.get("ref") == "refs/heads/main"


async def _cron_allowed(secret: str, authorization: str) -> bool:
    if settings.cron_secret and secret and hmac.compare_digest(secret, settings.cron_secret):
        return True
    bearer = authorization.removeprefix("Bearer ").strip() if authorization.startswith("Bearer ") else ""
    return bool(bearer) and await run_in_threadpool(_github_oidc_ok, bearer)


@router.post("/cron/{job}")
async def cron(
    job: Literal["tick", "daily"],
    db: DB,
    x_cron_secret: str = Header(default=""),
    authorization: str = Header(default=""),
):
    """ARQ worker o'rniga — tashqi cron "tick" (har N daqiqada) va "daily" (kuniga bir marta) chaqiradi.

    Ruxsat: X-Cron-Secret kaliti yoki GitHub Actions OIDC tokeni (.github/workflows/cron.yml).
    Bildirishnomalar bazada dedupe qilinadi, shuning uchun takroriy chaqiruv xavfsiz.
    """
    if not await _cron_allowed(x_cron_secret, authorization):
        raise AppError("not_found", 404)
    if job == "tick":
        return await jobs.minute_tick(db)
    return {"purged": await jobs.purge_deleted_accounts(db, datetime.now(UTC))}

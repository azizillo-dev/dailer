import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    admin,
    ai,
    auth,
    badges,
    challenges,
    content,
    focus,
    journal,
    me,
    notifications,
    routine,
    stats,
    trackers,
)
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.i18n import current_lang, pick_language

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Dailer API",
    version="0.1.0",
    docs_url="/docs" if settings.is_dev else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def language_middleware(request: Request, call_next):
    token = current_lang.set(pick_language(request.headers.get("accept-language")))
    try:
        return await call_next(request)
    finally:
        current_lang.reset(token)


register_error_handlers(app)

# Yuklangan fayllar (avatar, banner). Production'da CDN / obyekt saqlash ortida bo'ladi.
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

API = "/api/v1"
app.include_router(auth.router, prefix=API)
app.include_router(me.router, prefix=API)
app.include_router(routine.router, prefix=API)
app.include_router(stats.router, prefix=API)
app.include_router(focus.router, prefix=API)
app.include_router(content.router, prefix=API)
app.include_router(admin.router, prefix=API)
app.include_router(ai.router, prefix=API)
app.include_router(challenges.router, prefix=API)
app.include_router(notifications.router, prefix=API)
app.include_router(journal.router, prefix=API)
app.include_router(trackers.router, prefix=API)
app.include_router(badges.router, prefix=API)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}

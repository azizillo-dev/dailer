import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, me, routine, stats
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

API = "/api/v1"
app.include_router(auth.router, prefix=API)
app.include_router(me.router, prefix=API)
app.include_router(routine.router, prefix=API)
app.include_router(stats.router, prefix=API)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok"}

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.i18n import t

log = logging.getLogger(__name__)


class AppError(Exception):
    """Mijozga ko'rsatiladigan xato. `code` bo'yicha xabar tarjima qilinadi."""

    def __init__(self, code: str, status: int = 400):
        self.code = code
        self.status = status


def _body(code: str, details=None) -> dict:
    error = {"code": code, "message": t(code)}
    if details is not None:
        error["details"] = details
    return {"error": error}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code), status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "type": e["type"]}
            for e in exc.errors()
        ]
        return JSONResponse(_body("validation_error", details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        code = {401: "not_authenticated", 403: "forbidden", 404: "not_found"}.get(
            exc.status_code, "internal_error"
        )
        return JSONResponse(_body(code), status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(_body("internal_error"), status_code=500)

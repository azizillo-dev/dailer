from dataclasses import dataclass

from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import settings
from app.core.errors import AppError

_request = google_requests.Request()


@dataclass
class GoogleIdentity:
    sub: str
    email: str
    email_verified: bool
    name: str
    picture: str | None


def _verify(token: str) -> dict:
    # audience=None — quyida o'zimiz bir nechta client ID (web, android, ios) bilan tekshiramiz
    return google_id_token.verify_oauth2_token(token, _request, audience=None)


async def verify_google_token(token: str) -> GoogleIdentity:
    client_ids = settings.google_client_id_list
    if not client_ids:
        raise AppError("google_not_configured", 503)
    try:
        info = await run_in_threadpool(_verify, token)
    except ValueError as exc:
        raise AppError("google_auth_failed", 401) from exc

    if info.get("aud") not in client_ids or not info.get("email"):
        raise AppError("google_auth_failed", 401)

    return GoogleIdentity(
        sub=info["sub"],
        email=info["email"].lower(),
        email_verified=bool(info.get("email_verified")),
        name=info.get("name") or "",
        picture=info.get("picture"),
    )

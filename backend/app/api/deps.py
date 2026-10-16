from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_token
from app.db.session import get_db
from app.models import User, UserStatus

_bearer = HTTPBearer(auto_error=False)

DB = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> User:
    if creds is None:
        raise AppError("not_authenticated", 401)
    user_id = decode_token(creds.credentials, "access")
    if user_id is None:
        raise AppError("not_authenticated", 401)
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("not_authenticated", 401)
    if user.status == UserStatus.blocked:
        raise AppError("account_blocked", 403)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_admin(user: CurrentUser) -> User:
    # Admin API faqat emaili tasdiqlangan va 2FA yoqilgan adminlarga ochiq
    if not user.is_admin or not user.has_2fa or user.email_verified_at is None:
        raise AppError("forbidden", 403)
    return user


AdminUser = Annotated[User, Depends(get_admin)]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

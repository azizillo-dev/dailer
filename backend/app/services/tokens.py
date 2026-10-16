import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    hash_token,
    new_opaque_token,
    now,
)
from app.models import EmailToken, EmailTokenPurpose, RefreshToken, User
from app.schemas.auth import TokenPair


async def issue_token_pair(
    db: AsyncSession, user: User, user_agent: str | None, family_id: uuid.UUID | None = None
) -> TokenPair:
    raw = new_opaque_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            family_id=family_id or uuid.uuid4(),
            user_agent=(user_agent or "")[:255] or None,
            created_at=now(),
            expires_at=now() + timedelta(days=settings.refresh_token_days),
        )
    )
    await db.commit()
    return TokenPair(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=raw,
        expires_in=settings.access_token_minutes * 60,
    )


async def rotate_refresh_token(
    db: AsyncSession, raw: str, user_agent: str | None
) -> tuple[User, TokenPair]:
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw)))
    if token is None:
        raise AppError("invalid_token", 401)

    if token.revoked_at is not None:
        # Bekor qilingan token qayta ishlatildi — ehtimol o'g'irlangan.
        # Xavfsizlik uchun butun zanjirni bekor qilamiz.
        await revoke_family(db, token.family_id)
        raise AppError("invalid_token", 401)

    if token.expires_at < now():
        raise AppError("token_expired", 401)

    user = await db.get(User, token.user_id)
    if user is None or user.status.value == "blocked":
        raise AppError("account_blocked", 403)

    token.revoked_at = now()
    pair = await issue_token_pair(db, user, user_agent, family_id=token.family_id)
    return user, pair


async def revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now())
    )
    await db.commit()


async def revoke_refresh_token(db: AsyncSession, raw: str) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now())
    )
    await db.commit()


async def revoke_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now())
    )
    await db.commit()


async def create_email_token(
    db: AsyncSession, user: User, purpose: EmailTokenPurpose, lifetime: timedelta
) -> str:
    # Avvalgi ishlatilmagan havolalar yaroqsiz bo'ladi
    await db.execute(
        update(EmailToken)
        .where(
            EmailToken.user_id == user.id,
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
        )
        .values(used_at=now())
    )
    raw = new_opaque_token()
    db.add(
        EmailToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(raw),
            created_at=now(),
            expires_at=now() + lifetime,
        )
    )
    await db.commit()
    return raw


async def consume_email_token(db: AsyncSession, raw: str, purpose: EmailTokenPurpose) -> User:
    token = await db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == hash_token(raw), EmailToken.purpose == purpose
        )
    )
    if token is None or token.used_at is not None:
        raise AppError("invalid_token", 400)
    if token.expires_at < now():
        raise AppError("token_expired", 400)

    user = await db.get(User, token.user_id)
    if user is None:
        raise AppError("invalid_token", 400)
    token.used_at = now()
    return user

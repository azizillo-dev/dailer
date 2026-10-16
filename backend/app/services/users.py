from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import now
from app.models import Language, Profile, User, UserRole
from app.schemas.user import MeOut, ProfileOut


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == email.lower()))


def new_user(email: str, full_name: str, language: Language, password_hash: str | None = None) -> User:
    user = User(email=email.lower(), password_hash=password_hash)
    user.profile = Profile(full_name=full_name.strip(), language=language)
    return user


def mark_email_verified(user: User) -> None:
    """Email tasdiqlanganda chaqiriladi. Super admin roli faqat tasdiqlangan email'ga beriladi —
    aks holda kimdir shu email bilan ro'yxatdan o'tib admin bo'lib olishi mumkin edi."""
    if user.email_verified_at is None:
        user.email_verified_at = now()
    if settings.superadmin_email and user.email == settings.superadmin_email.lower():
        user.role = UserRole.super_admin


def to_me(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified_at is not None,
        role=user.role,
        has_password=user.password_hash is not None,
        has_google=user.google_sub is not None,
        has_2fa=user.has_2fa,
        created_at=user.created_at,
        profile=ProfileOut.model_validate(user.profile),
    )

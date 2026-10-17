from fastapi import APIRouter, File, UploadFile

from app.api.deps import DB, CurrentUser
from app.core.security import now
from app.models import User, UserStatus
from app.schemas.auth import MessageOut
from app.schemas.user import MeOut, OnboardingIn, ProfileUpdateIn
from app.services import tokens, uploads
from app.services.users import to_me

router = APIRouter(prefix="/me", tags=["me"])


def _apply(user: User, body: ProfileUpdateIn) -> None:
    data = body.model_dump(exclude_unset=True)
    if "busy_blocks" in data:
        # JSONB'ga vaqtlar matn ko'rinishida yoziladi
        data["busy_blocks"] = [b.model_dump(mode="json") for b in body.busy_blocks or []]
    for field, value in data.items():
        setattr(user.profile, field, value)


@router.get("", response_model=MeOut)
async def get_me(user: CurrentUser):
    return to_me(user)


@router.patch("/profile", response_model=MeOut)
async def update_profile(body: ProfileUpdateIn, user: CurrentUser, db: DB):
    _apply(user, body)
    await db.commit()
    await db.refresh(user)
    return to_me(user)


@router.post("/onboarding", response_model=MeOut)
async def complete_onboarding(body: OnboardingIn, user: CurrentUser, db: DB):
    _apply(user, body)
    if user.profile.onboarding_completed_at is None:
        user.profile.onboarding_completed_at = now()
    await db.commit()
    await db.refresh(user)
    # Keyingi qadam: GET /routine/starter-plan → foydalanuvchi tasdiqlaydi → /routine-items/bulk
    return to_me(user)


@router.post("/avatar", response_model=MeOut)
async def upload_avatar(user: CurrentUser, db: DB, file: UploadFile = File(...)):
    rel = await uploads.save_image(file, "avatars", db, size=(320, 320), square=True)
    await uploads.remove(user.profile.avatar_url, db)
    user.profile.avatar_url = uploads.public_url(rel)
    await db.commit()
    await db.refresh(user)
    return to_me(user)


@router.delete("/avatar", response_model=MeOut)
async def delete_avatar(user: CurrentUser, db: DB):
    await uploads.remove(user.profile.avatar_url, db)
    user.profile.avatar_url = None
    await db.commit()
    await db.refresh(user)
    return to_me(user)


@router.delete("", response_model=MessageOut)
async def request_deletion(user: CurrentUser, db: DB):
    """Akkaunt 30 kundan keyin butunlay o'chiriladi. Shu muddat ichida kirsa — bekor bo'ladi."""
    user.status = UserStatus.pending_deletion
    user.deletion_requested_at = now()
    await db.commit()
    await tokens.revoke_all_for_user(db, user.id)
    return MessageOut()

from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.core.security import now
from app.schemas.user import MeOut, OnboardingIn, ProfileUpdateIn
from app.services.users import to_me

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=MeOut)
async def get_me(user: CurrentUser):
    return to_me(user)


@router.patch("/profile", response_model=MeOut)
async def update_profile(body: ProfileUpdateIn, user: CurrentUser, db: DB):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user.profile, field, value)
    await db.commit()
    await db.refresh(user)
    return to_me(user)


@router.post("/onboarding", response_model=MeOut)
async def complete_onboarding(body: OnboardingIn, user: CurrentUser, db: DB):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user.profile, field, value)
    if user.profile.onboarding_completed_at is None:
        user.profile.onboarding_completed_at = now()
    await db.commit()
    await db.refresh(user)
    # Keyingi qadam: AI shu javoblardan birinchi kun tartibini tuzadi (/ai/plan)
    return to_me(user)

from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.services import badges as bd

router = APIRouter(tags=["badges"])


@router.get("/badges")
async def list_badges(db: DB, user: CurrentUser):
    """Barcha nishonlar: olinganlari sanasi bilan. Chaqirilganda yangilari ham tekshiriladi."""
    earned, new = await bd.evaluate(db, user)
    when = {b.code: b.earned_at for b in earned}
    lang = user.profile.language.value
    p = user.profile
    return {
        "xp": p.xp,
        "level": p.level,
        "level_xp": bd.LEVEL_XP,
        "xp_in_level": p.xp % bd.LEVEL_XP,
        "new": new,
        "badges": [
            {
                "code": b.code, "icon": b.icon, "xp": b.xp,
                "title": b.title.get(lang) or b.title["uz"], "text": b.text.get(lang) or b.text["uz"],
                "earned_at": when.get(b.code),
            }
            for b in bd.BADGES
        ],
    }

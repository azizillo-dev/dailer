import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select

from app.api.deps import DB, AdminUser, CurrentUser
from app.core.errors import AppError
from app.core.security import now
from app.models import (
    Challenge,
    ChallengeKind,
    ChallengeLog,
    ChallengeParticipant,
    ChallengeVisibility,
    Profile,
    User,
)
from app.services import audit
from app.services.schedule import local_today

router = APIRouter(tags=["challenges"])

MAX_ACTIVE = 10
DEFAULT_UNIT = {
    ChallengeKind.language_words: {"uz": "so'z", "ru": "слов", "en": "words"},
    ChallengeKind.reading_pages: {"uz": "bet", "ru": "стр.", "en": "pages"},
}


class ChallengeIn(BaseModel):
    kind: ChallengeKind = ChallengeKind.language_words
    title: str = Field(min_length=1, max_length=120)
    language_code: str | None = Field(default=None, max_length=8)
    target_value: int = Field(ge=1, le=100000)
    unit: str | None = Field(default=None, max_length=24)
    duration_days: int = Field(ge=1, le=365)


class PublicChallengeIn(BaseModel):
    kind: ChallengeKind = ChallengeKind.language_words
    title: dict[str, str]
    description: dict[str, str] = {}
    language_code: str | None = Field(default=None, max_length=8)
    target_value: int = Field(ge=1, le=100000)
    unit: str = Field(min_length=1, max_length=24)
    duration_days: int = Field(ge=1, le=365)
    starts_on: date | None = None
    is_active: bool = True

    @field_validator("title")
    @classmethod
    def uz_required(cls, v):
        v = {k: s.strip() for k, s in v.items() if k in ("uz", "ru", "en") and s and s.strip()}
        if not v.get("uz"):
            raise ValueError("uz title required")
        return v


class LogIn(BaseModel):
    date: date
    value: int = Field(ge=0, le=100000)
    note: str | None = Field(default=None, max_length=300)


class AdminChallengePatch(BaseModel):
    is_active: bool | None = None
    title: dict[str, str] | None = None

    @model_validator(mode="after")
    def check(self):
        if self.title is not None and not (self.title.get("uz") or "").strip():
            raise ValueError("uz title required")
        return self


def _title(c: Challenge, lang: str) -> str:
    return c.title.get(lang) or c.title.get("uz") or next(iter(c.title.values()), "")


def _period(c: Challenge, p: ChallengeParticipant | None) -> tuple[date | None, date | None]:
    start = c.starts_on or (p.personal_start if p else None)
    if start is None:
        return None, None
    return start, c.ends_on or start + timedelta(days=c.duration_days - 1)


def _summary(c: Challenge, p: ChallengeParticipant | None, today: date, lang: str, participants: int | None = None) -> dict:
    start, end = _period(c, p)
    day = None
    expected = None
    if start and p:
        day = max(0, min(c.duration_days, (today - start).days + 1))
        expected = round(c.target_value * day / c.duration_days)
    return {
        "id": c.id,
        "kind": c.kind.value,
        "title": _title(c, lang),
        "title_i18n": c.title,
        "description": (c.description or {}).get(lang) or (c.description or {}).get("uz"),
        "language_code": c.language_code,
        "target_value": c.target_value,
        "unit": c.unit,
        "duration_days": c.duration_days,
        "visibility": c.visibility.value,
        "is_public": c.creator_id is None,
        "starts_on": start,
        "ends_on": end,
        "participants": participants,
        "joined": p is not None and p.left_at is None,
        "progress": p.progress_total if p else 0,
        "day": day,
        "expected": expected,
        "completed": bool(p and p.completed_at),
        "finished": bool(end and today > end),
        "show_on_profile": p.show_on_profile if p else None,
    }


async def _participant(db: DB, challenge_id: uuid.UUID, user_id: uuid.UUID) -> ChallengeParticipant | None:
    return await db.scalar(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == challenge_id,
            ChallengeParticipant.user_id == user_id,
            ChallengeParticipant.left_at.is_(None),
        )
    )


async def _visible(db: DB, cid: uuid.UUID, user: User) -> Challenge:
    c = await db.get(Challenge, cid)
    if c is None or (c.creator_id is not None and c.creator_id != user.id) or (c.creator_id is None and not c.is_active):
        raise AppError("not_found", 404)
    return c


async def _counts(db: DB, ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not ids:
        return {}
    rows = await db.execute(
        select(ChallengeParticipant.challenge_id, func.count())
        .where(ChallengeParticipant.challenge_id.in_(ids), ChallengeParticipant.left_at.is_(None))
        .group_by(ChallengeParticipant.challenge_id)
    )
    return dict(rows.all())


@router.get("/challenges")
async def list_challenges(db: DB, user: CurrentUser, scope: str = Query(default="mine", pattern="^(mine|public)$")):
    today = local_today(user.profile.timezone)
    lang = user.profile.language.value
    if scope == "mine":
        rows = (
            await db.execute(
                select(Challenge, ChallengeParticipant)
                .join(ChallengeParticipant, ChallengeParticipant.challenge_id == Challenge.id)
                .where(ChallengeParticipant.user_id == user.id, ChallengeParticipant.left_at.is_(None))
                .order_by(ChallengeParticipant.joined_at.desc())
            )
        ).all()
        counts = await _counts(db, [c.id for c, _ in rows if c.creator_id is None])
        return [_summary(c, p, today, lang, counts.get(c.id)) for c, p in rows]

    public = (
        await db.scalars(
            select(Challenge)
            .where(Challenge.creator_id.is_(None), Challenge.is_active.is_(True))
            .order_by(Challenge.created_at.desc())
        )
    ).all()
    counts = await _counts(db, [c.id for c in public])
    mine = {
        p.challenge_id: p
        for p in (
            await db.scalars(
                select(ChallengeParticipant).where(
                    ChallengeParticipant.user_id == user.id,
                    ChallengeParticipant.challenge_id.in_([c.id for c in public] or [uuid.uuid4()]),
                    ChallengeParticipant.left_at.is_(None),
                )
            )
        )
    }
    return [_summary(c, mine.get(c.id), today, lang, counts.get(c.id, 0)) for c in public]


async def _active_count(db: DB, user_id: uuid.UUID) -> int:
    return await db.scalar(
        select(func.count())
        .select_from(ChallengeParticipant)
        .where(
            ChallengeParticipant.user_id == user_id,
            ChallengeParticipant.left_at.is_(None),
            ChallengeParticipant.completed_at.is_(None),
        )
    ) or 0


@router.post("/challenges", status_code=201)
async def create_challenge(body: ChallengeIn, db: DB, user: CurrentUser):
    if await _active_count(db, user.id) >= MAX_ACTIVE:
        raise AppError("validation_error", 422)
    lang = user.profile.language.value
    unit = (body.unit or "").strip() or DEFAULT_UNIT.get(body.kind, {}).get(lang) or "marta"
    c = Challenge(
        creator_id=user.id, kind=body.kind, title={lang: body.title.strip()}, language_code=body.language_code,
        target_value=body.target_value, unit=unit, duration_days=body.duration_days,
    )
    db.add(c)
    await db.flush()
    today = local_today(user.profile.timezone)
    p = ChallengeParticipant(challenge_id=c.id, user_id=user.id, personal_start=today, joined_at=now())
    db.add(p)
    await db.commit()
    return _summary(c, p, today, lang)


@router.get("/challenges/{cid}")
async def challenge_detail(cid: uuid.UUID, db: DB, user: CurrentUser):
    c = await _visible(db, cid, user)
    today = local_today(user.profile.timezone)
    p = await _participant(db, c.id, user.id)
    count = (await _counts(db, [c.id])).get(c.id, 0) if c.creator_id is None else None
    data = _summary(c, p, today, user.profile.language.value, count)
    logs = []
    if p:
        logs = [
            {"date": log.date, "value": log.value, "note": log.note}
            for log in await db.scalars(
                select(ChallengeLog).where(ChallengeLog.participant_id == p.id).order_by(ChallengeLog.date)
            )
        ]
    data["logs"] = logs
    return data


@router.post("/challenges/{cid}/join")
async def join(cid: uuid.UUID, db: DB, user: CurrentUser):
    c = await _visible(db, cid, user)
    if c.creator_id is not None:
        raise AppError("not_found", 404)
    today = local_today(user.profile.timezone)
    if c.ends_on and today > c.ends_on:
        raise AppError("validation_error", 422)
    if await _participant(db, c.id, user.id):
        return await challenge_detail(cid, db, user)
    if await _active_count(db, user.id) >= MAX_ACTIVE:
        raise AppError("validation_error", 422)
    old = await db.scalar(
        select(ChallengeParticipant).where(
            ChallengeParticipant.challenge_id == c.id, ChallengeParticipant.user_id == user.id
        )
    )
    if old:  # qayta qo'shilish — avvalgi natija saqlanadi
        old.left_at = None
    else:
        db.add(ChallengeParticipant(challenge_id=c.id, user_id=user.id, personal_start=today, joined_at=now()))
    await db.commit()
    return await challenge_detail(cid, db, user)


@router.post("/challenges/{cid}/leave", status_code=204)
async def leave(cid: uuid.UUID, db: DB, user: CurrentUser):
    c = await _visible(db, cid, user)
    p = await _participant(db, c.id, user.id)
    if p is None:
        raise AppError("not_found", 404)
    if c.creator_id == user.id:
        await db.delete(c)  # shaxsiy challenge — butunlay o'chiriladi
    else:
        p.left_at = now()
    await db.commit()
    return Response(status_code=204)


@router.put("/challenges/{cid}/logs")
async def put_log(cid: uuid.UUID, body: LogIn, db: DB, user: CurrentUser):
    """Kunlik natija (shu kun uchun yangilanadi). 7 kun orqagacha, challenge oralig'ida."""
    c = await _visible(db, cid, user)
    p = await _participant(db, c.id, user.id)
    if p is None:
        raise AppError("not_found", 404)
    today = local_today(user.profile.timezone)
    start, end = _period(c, p)
    if body.date > today or body.date < today - timedelta(days=7) or (start and body.date < start) or (end and body.date > end):
        raise AppError("validation_error", 422)

    log = await db.scalar(select(ChallengeLog).where(ChallengeLog.participant_id == p.id, ChallengeLog.date == body.date))
    if log is None:
        db.add(ChallengeLog(participant_id=p.id, date=body.date, value=body.value, note=body.note))
    else:
        log.value, log.note = body.value, body.note
    await db.flush()
    p.progress_total = await db.scalar(
        select(func.coalesce(func.sum(ChallengeLog.value), 0)).where(ChallengeLog.participant_id == p.id)
    )
    if p.progress_total >= c.target_value and p.completed_at is None:
        p.completed_at = now()
    elif p.progress_total < c.target_value:
        p.completed_at = None
    await db.commit()
    return await challenge_detail(cid, db, user)


@router.get("/challenges/{cid}/leaderboard")
async def leaderboard(cid: uuid.UUID, db: DB, user: CurrentUser, limit: int = Query(default=20, ge=1, le=100)):
    c = await _visible(db, cid, user)
    if c.creator_id is not None:
        raise AppError("not_found", 404)
    rows = await db.execute(
        select(ChallengeParticipant, Profile.full_name, Profile.avatar_url, Profile.privacy)
        .join(Profile, Profile.user_id == ChallengeParticipant.user_id)
        .where(ChallengeParticipant.challenge_id == c.id, ChallengeParticipant.left_at.is_(None))
        .order_by(ChallengeParticipant.progress_total.desc(), ChallengeParticipant.joined_at)
        .limit(limit)
    )
    out = []
    for rank, (p, name, avatar, privacy) in enumerate(rows.all(), start=1):
        me = p.user_id == user.id
        # Yopiq profillar — faqat ismning birinchi harfi
        first = (name or "").split(" ")[0]
        shown = first if me or privacy.value == "public" else (first[:1] + "." if first else "—")
        out.append({
            "rank": rank, "name": shown, "avatar_url": avatar if me or privacy.value == "public" else None,
            "progress": p.progress_total, "completed": p.completed_at is not None, "me": me,
        })
    return out


@router.patch("/challenges/{cid}/profile")
async def toggle_profile(cid: uuid.UUID, db: DB, user: CurrentUser, show: bool = True):
    p = await _participant(db, cid, user.id)
    if p is None:
        raise AppError("not_found", 404)
    p.show_on_profile = show
    await db.commit()
    return {"show_on_profile": show}


# --- Admin: umumiy challenge'lar ---

@router.get("/admin/challenges")
async def admin_list(db: DB, _: AdminUser):
    rows = (await db.scalars(select(Challenge).where(Challenge.creator_id.is_(None)).order_by(Challenge.created_at.desc()))).all()
    counts = await _counts(db, [c.id for c in rows])
    return [
        {"id": c.id, "title": c.title, "kind": c.kind.value, "target_value": c.target_value, "unit": c.unit,
         "duration_days": c.duration_days, "starts_on": c.starts_on, "ends_on": c.ends_on,
         "is_active": c.is_active, "participants": counts.get(c.id, 0)}
        for c in rows
    ]


@router.post("/admin/challenges", status_code=201)
async def admin_create(body: PublicChallengeIn, db: DB, actor: AdminUser, request: Request):
    data = body.model_dump()
    starts = data["starts_on"]
    c = Challenge(
        creator_id=None, visibility=ChallengeVisibility.public,
        ends_on=starts + timedelta(days=body.duration_days - 1) if starts else None, **data,
    )
    db.add(c)
    await db.flush()
    audit.record(db, actor, "challenge.create", "challenge", c.id, data, request)
    await db.commit()
    return {"id": c.id}


@router.patch("/admin/challenges/{cid}")
async def admin_update(cid: uuid.UUID, body: AdminChallengePatch, db: DB, actor: AdminUser, request: Request):
    c = await db.get(Challenge, cid)
    if c is None or c.creator_id is not None:
        raise AppError("not_found", 404)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(c, k, v)
    audit.record(db, actor, "challenge.update", "challenge", c.id, data, request)
    await db.commit()
    return {"id": c.id, "is_active": c.is_active}

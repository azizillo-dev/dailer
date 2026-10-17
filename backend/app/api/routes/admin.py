import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, File, Query, Request, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import Date, cast, func, or_, select

from app.api.deps import DB, AdminUser
from app.core.errors import AppError
from app.core.security import now
from app.models import (
    AIProvider,
    AuditLog,
    Banner,
    BannerEvent,
    BannerEventType,
    Checkin,
    Motivation,
    Profile,
    User,
    UserRole,
    UserStatus,
)
from app.schemas.content import (
    BannerIn,
    BannerOut,
    BannerUpdate,
    MotivationIn,
    MotivationOut,
    MotivationUpdate,
)
from app.services import audit, uploads
from app.services.ai import router as ai_router
from app.services.redis import redis

router = APIRouter(prefix="/admin", tags=["admin"])


# --- Dashboard ---

@router.get("/dashboard")
async def dashboard(db: DB, _: AdminUser):
    stamp = now()
    day_ago, week_ago, month_ago = stamp - timedelta(days=1), stamp - timedelta(days=7), stamp - timedelta(days=30)

    async def count(*where) -> int:
        return await db.scalar(select(func.count()).select_from(User).where(*where)) or 0

    total = await count()
    new_7d = await count(User.created_at >= week_ago)
    dau = await count(User.last_seen_at >= day_ago)
    wau = await count(User.last_seen_at >= week_ago)
    mau = await count(User.last_seen_at >= month_ago)
    onboarded = await db.scalar(
        select(func.count()).select_from(Profile).where(Profile.onboarding_completed_at.is_not(None))
    ) or 0

    # 7 kunlik qaytish: 7–14 kun oldin ro'yxatdan o'tganlarning qanchasi oxirgi 7 kunda faol
    cohort = await count(User.created_at < week_ago, User.created_at >= stamp - timedelta(days=14))
    retained = await count(
        User.created_at < week_ago, User.created_at >= stamp - timedelta(days=14), User.last_seen_at >= week_ago
    )

    signups = await db.execute(
        select(cast(User.created_at, Date), func.count())
        .where(User.created_at >= stamp - timedelta(days=14))
        .group_by(cast(User.created_at, Date))
    )
    checkins = await db.execute(
        select(Checkin.date, func.count())
        .where(Checkin.date >= (stamp - timedelta(days=14)).date())
        .group_by(Checkin.date)
    )
    s_map = dict(signups.all())
    c_map = dict(checkins.all())
    days = [(stamp - timedelta(days=13 - i)).date() for i in range(14)]
    return {
        "users_total": total,
        "users_new_7d": new_7d,
        "dau": dau,
        "wau": wau,
        "mau": mau,
        "onboarding_rate": round(onboarded / total * 100, 1) if total else None,
        "retention_d7": round(retained / cohort * 100, 1) if cohort else None,
        "series": [{"date": d, "signups": s_map.get(d, 0), "checkins": c_map.get(d, 0)} for d in days],
    }


# --- Foydalanuvchilar ---

class UserRow(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    avatar_url: str | None
    role: UserRole
    status: UserStatus
    email_verified: bool
    onboarded: bool
    created_at: datetime
    last_seen_at: datetime | None


def _row(u: User) -> UserRow:
    return UserRow(
        id=u.id, email=u.email, full_name=u.profile.full_name, avatar_url=u.profile.avatar_url,
        role=u.role, status=u.status, email_verified=u.email_verified_at is not None,
        onboarded=u.profile.onboarding_completed_at is not None, created_at=u.created_at,
        last_seen_at=u.last_seen_at,
    )


@router.get("/users")
async def list_users(
    db: DB,
    _: AdminUser,
    q: str | None = Query(default=None, max_length=100),
    role: UserRole | None = None,
    status: UserStatus | None = None,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    stmt = select(User).join(Profile)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(User.email.like(like), func.lower(Profile.full_name).like(like)))
    if role:
        stmt = stmt.where(User.role == role)
    if status:
        stmt = stmt.where(User.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.order_by(User.created_at.desc()).limit(limit).offset(offset))).unique().all()
    return {"total": total, "items": [_row(u) for u in rows]}


class UserPatch(BaseModel):
    role: UserRole | None = None
    status: UserStatus | None = None


@router.patch("/users/{user_id}", response_model=UserRow)
async def update_user(user_id: uuid.UUID, body: UserPatch, db: DB, actor: AdminUser, request: Request):
    target = await db.get(User, user_id)
    if target is None:
        raise AppError("not_found", 404)
    if target.id == actor.id:
        raise AppError("forbidden", 403)  # o'zini bloklash/rolini tushirish mumkin emas
    is_super = actor.role == UserRole.super_admin
    if target.role in (UserRole.admin, UserRole.super_admin) and not is_super:
        raise AppError("forbidden", 403)
    if body.role is not None and body.role != target.role:
        if not is_super:
            raise AppError("forbidden", 403)
        if body.role == UserRole.super_admin:
            raise AppError("forbidden", 403)  # super admin faqat seed orqali
    diff = {}
    for field in ("role", "status"):
        value = getattr(body, field)
        if value is not None and value != getattr(target, field):
            diff[field] = [getattr(target, field), value]
            setattr(target, field, value)
    if diff:
        audit.record(db, actor, "user.update", "user", target.id, diff, request)
        await db.commit()
        if body.status == UserStatus.blocked:
            from app.services.tokens import revoke_all_for_user

            await revoke_all_for_user(db, target.id)
    await db.refresh(target)
    return _row(target)


# --- Motivatsiyalar ---

@router.get("/motivations", response_model=list[MotivationOut])
async def admin_motivations(db: DB, _: AdminUser, limit: int = Query(default=100, ge=1, le=200)):
    return (await db.scalars(select(Motivation).order_by(Motivation.created_at.desc()).limit(limit))).all()


@router.post("/motivations", response_model=MotivationOut, status_code=201)
async def create_motivation(body: MotivationIn, db: DB, actor: AdminUser, request: Request):
    m = Motivation(created_by=actor.id, **body.model_dump())
    db.add(m)
    await db.flush()
    audit.record(db, actor, "motivation.create", "motivation", m.id, body.model_dump(), request)
    await db.commit()
    await db.refresh(m)
    return m


@router.patch("/motivations/{mid}", response_model=MotivationOut)
async def update_motivation(mid: uuid.UUID, body: MotivationUpdate, db: DB, actor: AdminUser, request: Request):
    m = await db.get(Motivation, mid)
    if m is None:
        raise AppError("not_found", 404)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(m, k, v)
    audit.record(db, actor, "motivation.update", "motivation", m.id, data, request)
    await db.commit()
    await db.refresh(m)
    return m


@router.delete("/motivations/{mid}", status_code=204)
async def delete_motivation(mid: uuid.UUID, db: DB, actor: AdminUser, request: Request):
    m = await db.get(Motivation, mid)
    if m is None:
        raise AppError("not_found", 404)
    audit.record(db, actor, "motivation.delete", "motivation", m.id, {"text": m.text}, request)
    await db.delete(m)
    await db.commit()
    return Response(status_code=204)


# --- Bannerlar ---

def _banner_data(body: BannerIn | BannerUpdate, partial: bool) -> dict:
    data = body.model_dump(exclude_unset=partial)
    if "audience" in data and data["audience"] is not None:
        data["audience"] = {k: v for k, v in data["audience"].items() if v}
    return data


@router.get("/banners", response_model=list[BannerOut])
async def admin_banners(db: DB, _: AdminUser):
    return (await db.scalars(select(Banner).order_by(Banner.created_at.desc()).limit(200))).all()


@router.post("/banners", response_model=BannerOut, status_code=201)
async def create_banner(body: BannerIn, db: DB, actor: AdminUser, request: Request):
    data = _banner_data(body, partial=False)
    b = Banner(created_by=actor.id, **data)
    db.add(b)
    await db.flush()
    audit.record(db, actor, "banner.create", "banner", b.id, data, request)
    await db.commit()
    await db.refresh(b)
    return b


@router.patch("/banners/{bid}", response_model=BannerOut)
async def update_banner(bid: uuid.UUID, body: BannerUpdate, db: DB, actor: AdminUser, request: Request):
    b = await db.get(Banner, bid)
    if b is None:
        raise AppError("not_found", 404)
    data = _banner_data(body, partial=True)
    for k, v in data.items():
        setattr(b, k, v)
    if b.starts_at and b.ends_at and b.ends_at <= b.starts_at:
        raise AppError("validation_error", 422)
    audit.record(db, actor, "banner.update", "banner", b.id, data, request)
    await db.commit()
    await db.refresh(b)
    return b


@router.delete("/banners/{bid}", status_code=204)
async def delete_banner(bid: uuid.UUID, db: DB, actor: AdminUser, request: Request):
    b = await db.get(Banner, bid)
    if b is None:
        raise AppError("not_found", 404)
    audit.record(db, actor, "banner.delete", "banner", b.id, {"title": b.title}, request)
    await db.delete(b)
    await db.commit()
    return Response(status_code=204)


@router.get("/banners/{bid}/stats")
async def banner_stats(bid: uuid.UUID, db: DB, _: AdminUser, days: int = Query(default=14, ge=1, le=90)):
    since = now() - timedelta(days=days)
    rows = await db.execute(
        select(cast(BannerEvent.created_at, Date), BannerEvent.event, func.count())
        .where(BannerEvent.banner_id == bid, BannerEvent.created_at >= since)
        .group_by(cast(BannerEvent.created_at, Date), BannerEvent.event)
    )
    per_day: dict[date, dict[str, int]] = {}
    for d, event, n in rows:
        per_day.setdefault(d, {"impression": 0, "click": 0})[event.value] = n
    impressions = sum(v["impression"] for v in per_day.values())
    clicks = sum(v["click"] for v in per_day.values())
    unique = await db.scalar(
        select(func.count(func.distinct(BannerEvent.user_id))).where(
            BannerEvent.banner_id == bid, BannerEvent.created_at >= since,
            BannerEvent.event == BannerEventType.impression,
        )
    )
    return {
        "impressions": impressions,
        "clicks": clicks,
        "ctr": round(clicks / impressions * 100, 2) if impressions else None,
        "unique_viewers": unique or 0,
        "days": [{"date": d, **v} for d, v in sorted(per_day.items())],
    }


# --- Yuklash ---

@router.post("/uploads")
async def upload_image(
    _: AdminUser, file: UploadFile = File(...), folder: str = Query(default="banners", pattern="^(banners|motivations)$")
):
    rel = await uploads.save_image(file, folder, size=(1600, 1600))
    return {"url": uploads.public_url(rel)}


# --- AI provayderlar ---

def _provider_row(p: AIProvider, cooldown: int, count: int) -> dict:
    return {
        "id": p.id, "code": p.code, "name": p.name, "model": p.model, "base_url": p.base_url,
        "priority": p.priority, "enabled": p.enabled, "is_paid": p.is_paid,
        "daily_request_cap": p.daily_request_cap, "api_key_env": p.api_key_env,
        "has_key": bool(ai_router.api_key(p)), "cooldown_seconds": cooldown, "today_requests": count,
    }


@router.get("/ai/providers")
async def ai_providers(db: DB, _: AdminUser):
    rows = (await db.scalars(select(AIProvider).order_by(AIProvider.priority))).all()
    return [_provider_row(p, await ai_router.cooldown_left(p.code), await ai_router.today_count(p.code)) for p in rows]


class ProviderPatch(BaseModel):
    model: str | None = Field(default=None, min_length=1, max_length=128)
    priority: int | None = Field(default=None, ge=0, le=1000)
    enabled: bool | None = None
    daily_request_cap: int | None = Field(default=None, ge=0)
    clear_cooldown: bool = False


@router.patch("/ai/providers/{pid}")
async def update_provider(pid: uuid.UUID, body: ProviderPatch, db: DB, actor: AdminUser, request: Request):
    p = await db.get(AIProvider, pid)
    if p is None:
        raise AppError("not_found", 404)
    data = body.model_dump(exclude_unset=True, exclude={"clear_cooldown"})
    for k, v in data.items():
        setattr(p, k, v)
    if body.clear_cooldown:
        await redis.delete(f"ai:cooldown:{p.code}", f"ai:fail:{p.code}")
    audit.record(db, actor, "ai_provider.update", "ai_provider", p.id, {**data, "clear_cooldown": body.clear_cooldown}, request)
    await db.commit()
    return _provider_row(p, await ai_router.cooldown_left(p.code), await ai_router.today_count(p.code))


@router.post("/ai/providers/{pid}/test")
async def test_provider(pid: uuid.UUID, db: DB, _: AdminUser):
    p = await db.get(AIProvider, pid)
    if p is None:
        raise AppError("not_found", 404)
    if not ai_router.api_key(p):
        return {"ok": False, "error": f"{p.api_key_env} sozlanmagan"}
    started = now()
    try:
        parts = []
        async for token in ai_router._stream_one(p, [{"role": "user", "content": "O'zbekcha bitta qisqa jumla: salom!"}], 40):
            parts.append(token)
        return {"ok": True, "reply": "".join(parts)[:200], "ms": int((now() - started).total_seconds() * 1000)}
    except ai_router.ProviderError as err:
        return {"ok": False, "error": err.kind}


# --- Audit ---

@router.get("/audit-logs")
async def audit_logs(db: DB, _: AdminUser, limit: int = Query(default=50, ge=1, le=200)):
    rows = await db.execute(
        select(AuditLog, User.email)
        .join(User, User.id == AuditLog.actor_id, isouter=True)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": log.id, "actor": email, "action": log.action, "entity": log.entity,
            "entity_id": log.entity_id, "diff": log.diff, "created_at": log.created_at,
        }
        for log, email in rows
    ]

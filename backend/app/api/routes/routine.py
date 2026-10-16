import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, select, update

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.core.security import now
from app.models import (
    Category,
    Checkin,
    CheckinSource,
    RoutineItem,
    ScheduleMode,
    TaskTemplate,
)
from app.schemas.routine import (
    BulkIn,
    CheckinBatchIn,
    CheckinIn,
    CheckinOut,
    DayOut,
    ItemIn,
    ItemOut,
    ItemUpdate,
    ModeIn,
    ModeOut,
    ModeUpdate,
    PlanItemOut,
    ReorderIn,
    TemplateOut,
)
from app.services import planner, prayer
from app.services.schedule import build_day, local_today

router = APIRouter(tags=["routine"])

MAX_ITEMS = 60
# Check-in'ni necha kun orqaga kiritish mumkin
BACKFILL_DAYS = 7


# --- Shablonlar ---

@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(db: DB, _: CurrentUser, category: Category | None = None):
    q = select(TaskTemplate).where(TaskTemplate.is_active.is_(True))
    if category:
        q = q.where(TaskTemplate.category == category)
    return (await db.scalars(q.order_by(TaskTemplate.sort_order))).all()


# --- Rejimlar ---

async def _own_mode(db: DB, user_id: uuid.UUID, mode_id: uuid.UUID) -> ScheduleMode:
    mode = await db.get(ScheduleMode, mode_id)
    if mode is None or mode.user_id != user_id:
        raise AppError("not_found", 404)
    return mode


@router.get("/modes", response_model=list[ModeOut])
async def list_modes(db: DB, user: CurrentUser):
    rows = await db.scalars(
        select(ScheduleMode).where(ScheduleMode.user_id == user.id).order_by(ScheduleMode.created_at)
    )
    return rows.all()


@router.post("/modes", response_model=ModeOut, status_code=201)
async def create_mode(body: ModeIn, db: DB, user: CurrentUser):
    mode = ScheduleMode(user_id=user.id, **body.model_dump())
    db.add(mode)
    await db.commit()
    return mode


@router.patch("/modes/{mode_id}", response_model=ModeOut)
async def update_mode(mode_id: uuid.UUID, body: ModeUpdate, db: DB, user: CurrentUser):
    mode = await _own_mode(db, user.id, mode_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(mode, k, v)
    await db.commit()
    return mode


@router.delete("/modes/{mode_id}", status_code=204)
async def delete_mode(mode_id: uuid.UUID, db: DB, user: CurrentUser):
    mode = await _own_mode(db, user.id, mode_id)
    await db.delete(mode)  # vazifalar mode_id=NULL bo'ladi (har kuni)
    await db.commit()
    return Response(status_code=204)


# --- Vazifalar ---

async def _own_item(db: DB, user_id: uuid.UUID, item_id: uuid.UUID) -> RoutineItem:
    item = await db.get(RoutineItem, item_id)
    if item is None or item.user_id != user_id or item.archived_at is not None:
        raise AppError("not_found", 404)
    return item


async def _check_mode(db: DB, user_id: uuid.UUID, mode_id: uuid.UUID | None) -> None:
    if mode_id is not None:
        await _own_mode(db, user_id, mode_id)


async def _item_fields(db: DB, body: ItemIn) -> dict:
    data = body.model_dump(exclude={"template_code"})
    if body.template_code and not body.template_id:
        data["template_id"] = await db.scalar(
            select(TaskTemplate.id).where(TaskTemplate.code == body.template_code)
        )
    return data


async def _active_count(db: DB, user_id: uuid.UUID) -> int:
    return await db.scalar(
        select(func.count()).where(RoutineItem.user_id == user_id, RoutineItem.archived_at.is_(None))
    )


@router.get("/routine-items", response_model=list[ItemOut])
async def list_items(db: DB, user: CurrentUser, mode_id: uuid.UUID | None = None):
    q = select(RoutineItem).where(RoutineItem.user_id == user.id, RoutineItem.archived_at.is_(None))
    if mode_id:
        q = q.where(RoutineItem.mode_id == mode_id)
    rows = await db.scalars(q.order_by(RoutineItem.start_time.nulls_last(), RoutineItem.sort_order))
    return rows.unique().all()


@router.post("/routine-items", response_model=ItemOut, status_code=201)
async def create_item(body: ItemIn, db: DB, user: CurrentUser):
    await _check_mode(db, user.id, body.mode_id)
    if await _active_count(db, user.id) >= MAX_ITEMS:
        raise AppError("validation_error", 422)
    last = await db.scalar(
        select(func.max(RoutineItem.sort_order)).where(RoutineItem.user_id == user.id)
    )
    item = RoutineItem(user_id=user.id, sort_order=(last or 0) + 10, **await _item_fields(db, body))
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/routine-items/bulk", response_model=list[ItemOut], status_code=201)
async def bulk_create(body: BulkIn, db: DB, user: CurrentUser):
    if body.replace:
        await db.execute(
            update(RoutineItem)
            .where(RoutineItem.user_id == user.id, RoutineItem.archived_at.is_(None))
            .values(archived_at=now(), is_active=False)
        )
    elif await _active_count(db, user.id) + len(body.items) > MAX_ITEMS:
        raise AppError("validation_error", 422)

    items = []
    for i, b in enumerate(body.items):
        await _check_mode(db, user.id, b.mode_id)
        items.append(RoutineItem(user_id=user.id, sort_order=i * 10, **await _item_fields(db, b)))
    db.add_all(items)
    await db.commit()
    for item in items:
        await db.refresh(item)
    return items


@router.patch("/routine-items/{item_id}", response_model=ItemOut)
async def update_item(item_id: uuid.UUID, body: ItemUpdate, db: DB, user: CurrentUser):
    item = await _own_item(db, user.id, item_id)
    data = body.model_dump(exclude_unset=True)
    if "mode_id" in data:
        await _check_mode(db, user.id, data["mode_id"])
    for k, v in data.items():
        setattr(item, k, v)
    if item.time_from_prayer and item.prayer_name is None:
        raise AppError("validation_error", 422)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/routine-items/{item_id}", status_code=204)
async def delete_item(item_id: uuid.UUID, db: DB, user: CurrentUser):
    item = await _own_item(db, user.id, item_id)
    # Arxivlanadi — o'tgan check-in'lar va statistika saqlanadi
    item.archived_at = now()
    item.is_active = False
    await db.commit()
    return Response(status_code=204)


@router.post("/routine-items/reorder", status_code=204)
async def reorder(body: ReorderIn, db: DB, user: CurrentUser):
    rows = await db.scalars(
        select(RoutineItem).where(RoutineItem.user_id == user.id, RoutineItem.id.in_(body.ids))
    )
    by_id = {i.id: i for i in rows.unique()}
    for order, item_id in enumerate(body.ids):
        if item_id in by_id:
            by_id[item_id].sort_order = order * 10
    await db.commit()
    return Response(status_code=204)


@router.get("/routine/starter-plan", response_model=list[PlanItemOut])
async def starter_plan(user: CurrentUser):
    """Onboarding javoblaridan taklif qilinadigan reja. Saqlanmaydi — foydalanuvchi tasdiqlaydi."""
    return planner.starter_plan(user.profile, local_today(user.profile.timezone))


# --- Bugun va check-in ---

@router.get("/today", response_model=DayOut)
async def today(db: DB, user: CurrentUser, day: date | None = Query(default=None, alias="date")):
    return await build_day(db, user, day or local_today(user.profile.timezone))


async def _upsert_checkin(db: DB, user, body: CheckinIn, source: CheckinSource) -> Checkin:
    today_local = local_today(user.profile.timezone)
    if body.date > today_local or body.date < today_local - timedelta(days=BACKFILL_DAYS):
        raise AppError("validation_error", 422)
    item = await _own_item(db, user.id, body.routine_item_id)

    checkin = await db.scalar(
        select(Checkin).where(Checkin.routine_item_id == item.id, Checkin.date == body.date)
    )
    stamp = now()
    if checkin is None:
        checkin = Checkin(user_id=user.id, routine_item_id=item.id, date=body.date, checked_at=stamp)
        db.add(checkin)
    checkin.status = body.status
    checkin.excuse_reason = body.excuse_reason
    checkin.value = body.value
    checkin.note = body.note
    checkin.source = source
    checkin.client_id = body.client_id
    checkin.updated_at = stamp
    return checkin


@router.put("/checkins", response_model=CheckinOut)
async def put_checkin(body: CheckinIn, db: DB, user: CurrentUser, source: CheckinSource = CheckinSource.app):
    checkin = await _upsert_checkin(db, user, body, source)
    await db.commit()
    return checkin


@router.post("/checkins/batch", response_model=list[CheckinOut])
async def batch_checkins(body: CheckinBatchIn, db: DB, user: CurrentUser):
    """Offline navbatini yuborish. Bir xil vazifa+kun uchun oxirgisi g'olib."""
    result = []
    for c in body.checkins:
        result.append(await _upsert_checkin(db, user, c, CheckinSource.app))
        await db.flush()
    await db.commit()
    return result


@router.delete("/checkins/{checkin_id}", status_code=204)
async def delete_checkin(checkin_id: uuid.UUID, db: DB, user: CurrentUser):
    checkin = await db.get(Checkin, checkin_id)
    if checkin is None or checkin.user_id != user.id:
        raise AppError("not_found", 404)
    await db.delete(checkin)
    await db.commit()
    return Response(status_code=204)


# --- Namoz vaqtlari ---

@router.get("/prayer/times")
async def prayer_times(user: CurrentUser, day: date | None = Query(default=None, alias="date"), days: int = Query(default=1, ge=1, le=31)):
    start = day or local_today(user.profile.timezone)
    return [
        {"date": d, "times": prayer.for_profile(user.profile, d)}
        for d in (start + timedelta(days=i) for i in range(days))
    ]


@router.get("/prayer/methods")
async def prayer_methods(_: CurrentUser):
    return sorted(prayer.METHODS)

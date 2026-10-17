import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Response
from pydantic import BaseModel, Field
from sqlalchemy import extract, func, select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.core.security import now
from app.models import (
    QURAN_PAGES,
    Book,
    BookStatus,
    Category,
    Checkin,
    CheckinSource,
    CheckinStatus,
    DhikrCounter,
    DhikrLog,
    QuranLog,
    QuranProgress,
    ReadingLog,
    RoutineItem,
    User,
)
from app.services.schedule import local_today

router = APIRouter(tags=["trackers"])

DEFAULT_DHIKR = [("Subhanalloh", 33), ("Alhamdulillah", 33), ("Allohu akbar", 34), ("Astag'firulloh", 100)]


async def auto_checkin(db: DB, user: User, category: Category, add: int, today: date) -> None:
    """Trekerdagi natija kun tartibidagi mos vazifaga ham yoziladi (maqsadga yetsa — bajarildi)."""
    if add <= 0:
        return
    items = (
        await db.scalars(
            select(RoutineItem).where(
                RoutineItem.user_id == user.id,
                RoutineItem.category == category,
                RoutineItem.archived_at.is_(None),
                RoutineItem.is_active.is_(True),
            )
        )
    ).unique().all()
    item = next((i for i in items if i.applies_on(today)), None)
    if item is None:
        return
    c = await db.scalar(select(Checkin).where(Checkin.routine_item_id == item.id, Checkin.date == today))
    stamp = now()
    if c is None:
        c = Checkin(user_id=user.id, routine_item_id=item.id, date=today, status=CheckinStatus.partial,
                    value=0, source=CheckinSource.app, checked_at=stamp, updated_at=stamp)
        db.add(c)
    if c.status == CheckinStatus.excused:
        return
    c.value = float(c.value or 0) + add
    target = float(item.target_value) if item.target_value else None
    c.status = CheckinStatus.done if target is None or c.value >= target else CheckinStatus.partial
    c.updated_at = stamp


# --- Kitoblar ---

class BookIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str | None = Field(default=None, max_length=120)
    total_pages: int = Field(ge=1, le=20000)
    current_page: int = Field(default=0, ge=0)
    status: BookStatus = BookStatus.reading


class BookPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    author: str | None = Field(default=None, max_length=120)
    total_pages: int | None = Field(default=None, ge=1, le=20000)
    status: BookStatus | None = None


class ProgressIn(BaseModel):
    current_page: int = Field(ge=0, le=20000)


def _book(b: Book, today_pages: int = 0) -> dict:
    return {
        "id": b.id, "title": b.title, "author": b.author, "total_pages": b.total_pages,
        "current_page": b.current_page, "status": b.status.value, "started_on": b.started_on,
        "finished_on": b.finished_on, "percent": round(min(100, b.current_page / b.total_pages * 100)),
        "today_pages": today_pages,
    }


async def _own_book(db: DB, user: User, bid: uuid.UUID) -> Book:
    b = await db.get(Book, bid)
    if b is None or b.user_id != user.id:
        raise AppError("not_found", 404)
    return b


@router.get("/books")
async def list_books(db: DB, user: CurrentUser):
    today = local_today(user.profile.timezone)
    books = (await db.scalars(select(Book).where(Book.user_id == user.id).order_by(Book.updated_at.desc()))).all()
    logs = dict(
        (await db.execute(select(ReadingLog.book_id, ReadingLog.pages).where(ReadingLog.user_id == user.id, ReadingLog.date == today))).all()
    )
    year = today.year
    finished_year = sum(1 for b in books if b.finished_on and b.finished_on.year == year)
    pages_year = await db.scalar(
        select(func.coalesce(func.sum(ReadingLog.pages), 0)).where(
            ReadingLog.user_id == user.id, extract("year", ReadingLog.date) == year
        )
    )
    week_pages = await db.scalar(
        select(func.coalesce(func.sum(ReadingLog.pages), 0)).where(
            ReadingLog.user_id == user.id, ReadingLog.date >= today - timedelta(days=6)
        )
    )
    return {
        "books": [_book(b, logs.get(b.id, 0)) for b in books],
        "year": year, "finished_this_year": finished_year,
        "pages_this_year": int(pages_year or 0), "pages_last_7_days": int(week_pages or 0),
    }


@router.post("/books", status_code=201)
async def add_book(body: BookIn, db: DB, user: CurrentUser):
    today = local_today(user.profile.timezone)
    b = Book(user_id=user.id, started_on=today if body.status == BookStatus.reading else None, **body.model_dump())
    b.current_page = min(b.current_page, b.total_pages)
    db.add(b)
    await db.commit()
    return _book(b)


@router.patch("/books/{bid}")
async def update_book(bid: uuid.UUID, body: BookPatch, db: DB, user: CurrentUser):
    b = await _own_book(db, user, bid)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(b, k, v)
    today = local_today(user.profile.timezone)
    if b.status == BookStatus.reading and b.started_on is None:
        b.started_on = today
    if b.status == BookStatus.finished and b.finished_on is None:
        b.finished_on = today
    await db.commit()
    return _book(b)


@router.post("/books/{bid}/progress")
async def book_progress(bid: uuid.UUID, body: ProgressIn, db: DB, user: CurrentUser):
    """Qaysi betga yetganini kiritadi; farq bugungi o'qilgan bet sifatida yoziladi."""
    b = await _own_book(db, user, bid)
    today = local_today(user.profile.timezone)
    page = min(body.current_page, b.total_pages)
    delta = page - b.current_page
    log = await db.scalar(select(ReadingLog).where(ReadingLog.book_id == b.id, ReadingLog.date == today))
    if log is None:
        log = ReadingLog(user_id=user.id, book_id=b.id, date=today, pages=0)
        db.add(log)
    # Orqaga qaytarilsa (xato kiritilgan bo'lsa) — bugungi hisob ham kamayadi, lekin manfiy emas
    log.pages = max(0, log.pages + delta)
    b.current_page = page
    if b.started_on is None:
        b.started_on = today
    if b.status in (BookStatus.planned, BookStatus.paused):
        b.status = BookStatus.reading
    if page >= b.total_pages:
        b.status, b.finished_on = BookStatus.finished, b.finished_on or today
    await auto_checkin(db, user, Category.reading, delta, today)
    await db.commit()
    return _book(b, log.pages)


@router.delete("/books/{bid}", status_code=204)
async def delete_book(bid: uuid.UUID, db: DB, user: CurrentUser):
    b = await _own_book(db, user, bid)
    await db.delete(b)
    await db.commit()
    return Response(status_code=204)


# --- Qur'on ---

class QuranIn(BaseModel):
    pages: int = Field(ge=1, le=QURAN_PAGES)


class QuranSettings(BaseModel):
    daily_target_pages: int | None = Field(default=None, ge=1, le=100)
    current_page: int | None = Field(default=None, ge=0, le=QURAN_PAGES)
    khatm_count: int | None = Field(default=None, ge=0, le=1000)


async def _quran(db: DB, user: User) -> QuranProgress:
    q = await db.get(QuranProgress, user.id)
    if q is None:
        q = QuranProgress(user_id=user.id, current_page=0, khatm_count=0, daily_target_pages=2)
        db.add(q)
        await db.flush()
    return q


async def _quran_out(db: DB, user: User, q: QuranProgress) -> dict:
    today = local_today(user.profile.timezone)
    rows = dict(
        (
            await db.execute(
                select(QuranLog.date, QuranLog.pages).where(QuranLog.user_id == user.id, QuranLog.date >= today - timedelta(days=6))
            )
        ).all()
    )
    week = [{"date": today - timedelta(days=6 - i), "pages": rows.get(today - timedelta(days=6 - i), 0)} for i in range(7)]
    pages_left = QURAN_PAGES - q.current_page
    return {
        "current_page": q.current_page, "total_pages": QURAN_PAGES, "khatm_count": q.khatm_count,
        "daily_target_pages": q.daily_target_pages, "today_pages": rows.get(today, 0),
        "percent": round(q.current_page / QURAN_PAGES * 100, 1),
        "juz": min(30, q.current_page // 20 + 1),
        "days_to_khatm": -(-pages_left // q.daily_target_pages) if q.daily_target_pages else None,
        "week": week,
    }


@router.get("/quran")
async def quran(db: DB, user: CurrentUser):
    q = await _quran(db, user)
    await db.commit()
    return await _quran_out(db, user, q)


@router.post("/quran/read")
async def quran_read(body: QuranIn, db: DB, user: CurrentUser):
    q = await _quran(db, user)
    today = local_today(user.profile.timezone)
    log = await db.scalar(select(QuranLog).where(QuranLog.user_id == user.id, QuranLog.date == today))
    if log is None:
        log = QuranLog(user_id=user.id, date=today, pages=0)
        db.add(log)
    log.pages += body.pages
    q.current_page += body.pages
    khatm = False
    while q.current_page >= QURAN_PAGES:
        q.current_page -= QURAN_PAGES
        q.khatm_count += 1
        khatm = True
    await auto_checkin(db, user, Category.quran, body.pages, today)
    await db.commit()
    return {**(await _quran_out(db, user, q)), "khatm_completed": khatm}


@router.patch("/quran")
async def quran_settings(body: QuranSettings, db: DB, user: CurrentUser):
    q = await _quran(db, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(q, k, v)
    await db.commit()
    return await _quran_out(db, user, q)


# --- Zikr ---

class DhikrIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    target: int = Field(default=33, ge=1, le=100000)


class DhikrAdd(BaseModel):
    count: int = Field(ge=1, le=10000)


async def _dhikr_list(db: DB, user: User) -> list[dict]:
    today = local_today(user.profile.timezone)
    counters = (
        await db.scalars(
            select(DhikrCounter).where(DhikrCounter.user_id == user.id, DhikrCounter.is_active.is_(True))
            .order_by(DhikrCounter.sort_order, DhikrCounter.created_at)
        )
    ).all()
    if not counters:
        # Birinchi ochilishda — an'anaviy zikrlar
        for i, (name, target) in enumerate(DEFAULT_DHIKR):
            db.add(DhikrCounter(user_id=user.id, name=name, target=target, sort_order=i))
        await db.commit()
        return await _dhikr_list(db, user)
    counts = dict(
        (
            await db.execute(
                select(DhikrLog.counter_id, DhikrLog.count).where(
                    DhikrLog.counter_id.in_([c.id for c in counters]), DhikrLog.date == today
                )
            )
        ).all()
    )
    return [{"id": c.id, "name": c.name, "target": c.target, "today": counts.get(c.id, 0)} for c in counters]


@router.get("/dhikr")
async def dhikr(db: DB, user: CurrentUser):
    return await _dhikr_list(db, user)


@router.post("/dhikr", status_code=201)
async def add_dhikr(body: DhikrIn, db: DB, user: CurrentUser):
    last = await db.scalar(select(func.max(DhikrCounter.sort_order)).where(DhikrCounter.user_id == user.id))
    db.add(DhikrCounter(user_id=user.id, name=body.name.strip(), target=body.target, sort_order=(last or 0) + 1))
    await db.commit()
    return await _dhikr_list(db, user)


async def _own_counter(db: DB, user: User, cid: uuid.UUID) -> DhikrCounter:
    c = await db.get(DhikrCounter, cid)
    if c is None or c.user_id != user.id:
        raise AppError("not_found", 404)
    return c


@router.post("/dhikr/{cid}/add")
async def dhikr_add(cid: uuid.UUID, body: DhikrAdd, db: DB, user: CurrentUser):
    """Ilova bosishlarni to'plab yuboradi (har bosishda emas)."""
    c = await _own_counter(db, user, cid)
    today = local_today(user.profile.timezone)
    log = await db.scalar(select(DhikrLog).where(DhikrLog.counter_id == c.id, DhikrLog.date == today))
    if log is None:
        log = DhikrLog(counter_id=c.id, date=today, count=0)
        db.add(log)
    before = log.count
    log.count += body.count
    # Maqsadga birinchi yetganda — kun tartibidagi zikr vazifasi
    if before < c.target <= log.count:
        await auto_checkin(db, user, Category.dhikr, 1, today)
    await db.commit()
    return {"id": c.id, "today": log.count, "target": c.target}


@router.delete("/dhikr/{cid}", status_code=204)
async def delete_dhikr(cid: uuid.UUID, db: DB, user: CurrentUser):
    c = await _own_counter(db, user, cid)
    c.is_active = False
    await db.commit()
    return Response(status_code=204)

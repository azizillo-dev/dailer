import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.models import FocusKind, PomodoroSession, RoutineItem
from app.services.schedule import local_today

router = APIRouter(prefix="/pomodoro", tags=["focus"])


class SessionIn(BaseModel):
    kind: FocusKind = FocusKind.focus
    routine_item_id: uuid.UUID | None = None
    planned_min: int = Field(ge=1, le=240)
    actual_min: int = Field(ge=0, le=240)
    started_at: datetime
    ended_at: datetime
    completed: bool = True
    interruptions: int = Field(default=0, ge=0, le=100)
    client_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def order(self):
        if self.ended_at < self.started_at:
            raise ValueError("ended_at before started_at")
        return self


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: FocusKind
    routine_item_id: uuid.UUID | None
    date: date
    planned_min: int
    actual_min: int
    started_at: datetime
    ended_at: datetime
    completed: bool


@router.post("/sessions", response_model=SessionOut, status_code=201)
async def save_session(body: SessionIn, db: DB, user: CurrentUser):
    """Tugagan (yoki to'xtatilgan) sessiya yuboriladi. client_id bo'yicha takror yozilmaydi."""
    if body.client_id:
        existing = await db.scalar(
            select(PomodoroSession).where(
                PomodoroSession.client_id == body.client_id, PomodoroSession.user_id == user.id
            )
        )
        if existing:
            return existing
    if body.routine_item_id:
        item = await db.get(RoutineItem, body.routine_item_id)
        if item is None or item.user_id != user.id:
            raise AppError("not_found", 404)
    local_date = body.started_at.astimezone(ZoneInfo(user.profile.timezone)).date()
    session = PomodoroSession(user_id=user.id, date=local_date, **body.model_dump())
    db.add(session)
    await db.commit()
    return session


@router.get("/stats")
async def focus_stats(
    db: DB,
    user: CurrentUser,
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
):
    today = local_today(user.profile.timezone)
    end = date_to or today
    begin = date_from or end - timedelta(days=6)
    if begin > end or (end - begin).days > 92:
        raise AppError("validation_error", 422)

    rows = await db.execute(
        select(
            PomodoroSession.date,
            func.coalesce(func.sum(PomodoroSession.actual_min), 0),
            func.count().filter(PomodoroSession.completed.is_(True)),
        )
        .where(
            PomodoroSession.user_id == user.id,
            PomodoroSession.kind == FocusKind.focus,
            PomodoroSession.date >= begin,
            PomodoroSession.date <= end,
        )
        .group_by(PomodoroSession.date)
    )
    by_day = {d: (int(m), int(c)) for d, m, c in rows}
    days = [
        {"date": d, "minutes": by_day.get(d, (0, 0))[0], "sessions": by_day.get(d, (0, 0))[1]}
        for d in (begin + timedelta(days=i) for i in range((end - begin).days + 1))
    ]
    today_sessions = (
        await db.scalars(
            select(PomodoroSession)
            .where(PomodoroSession.user_id == user.id, PomodoroSession.date == today)
            .order_by(PomodoroSession.started_at)
        )
    ).all()
    return {
        "from": begin,
        "to": end,
        "days": days,
        "total_minutes": sum(d["minutes"] for d in days),
        "total_sessions": sum(d["sessions"] for d in days),
        "today": [SessionOut.model_validate(s) for s in today_sessions],
    }

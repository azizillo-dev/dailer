import json
import uuid

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, func, select, update

from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import now
from app.models import Device, Notification, Platform
from app.schemas.auth import MessageOut

router = APIRouter(tags=["notifications"])


class DeviceIn(BaseModel):
    platform: Platform
    # web: PushSubscription JSON; ios/android: Expo push token
    push_token: str = Field(min_length=10, max_length=4000)
    app_version: str | None = Field(default=None, max_length=32)
    locale: str | None = Field(default=None, max_length=16)

    @model_validator(mode="after")
    def check(self):
        if self.platform == Platform.web:
            try:
                sub = json.loads(self.push_token)
                assert sub["endpoint"].startswith("https://") and sub["keys"]["p256dh"] and sub["keys"]["auth"]
            except Exception as exc:
                raise ValueError("invalid web push subscription") from exc
        return self


@router.get("/push/vapid-public-key")
async def vapid_key():
    return {"key": settings.vapid_public_key or None}


@router.post("/me/devices", response_model=MessageOut)
async def register_device(body: DeviceIn, db: DB, user: CurrentUser):
    existing = await db.scalar(select(Device).where(Device.push_token == body.push_token))
    if existing:
        # Qurilma boshqa akkauntga o'tgan bo'lishi mumkin — oxirgi kirgan egasi
        existing.user_id = user.id
        existing.last_active_at = now()
        existing.app_version, existing.locale = body.app_version, body.locale
    else:
        db.add(Device(user_id=user.id, last_active_at=now(), **body.model_dump()))
    await db.commit()
    return MessageOut()


@router.delete("/me/devices", response_model=MessageOut)
async def unregister_device(db: DB, user: CurrentUser, push_token: str = Query(max_length=4000)):
    await db.execute(delete(Device).where(Device.user_id == user.id, Device.push_token == push_token))
    await db.commit()
    return MessageOut()


def _out(n: Notification) -> dict:
    return {
        "id": n.id, "kind": n.kind.value, "title": n.title, "body": n.body, "data": n.data,
        "read": n.read_at is not None, "created_at": n.created_at,
    }


@router.get("/notifications")
async def list_notifications(db: DB, user: CurrentUser, limit: int = Query(default=30, ge=1, le=100)):
    rows = await db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(limit)
    )
    return [_out(n) for n in rows]


@router.get("/notifications/unread-count")
async def unread_count(db: DB, user: CurrentUser):
    n = await db.scalar(
        select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    )
    return {"count": n or 0}


@router.post("/notifications/{nid}/read", status_code=204)
async def mark_read(nid: uuid.UUID, db: DB, user: CurrentUser):
    n = await db.get(Notification, nid)
    if n is None or n.user_id != user.id:
        raise AppError("not_found", 404)
    n.read_at = n.read_at or now()
    await db.commit()
    return Response(status_code=204)


@router.post("/notifications/read-all", response_model=MessageOut)
async def mark_all_read(db: DB, user: CurrentUser):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=now())
    )
    await db.commit()
    return MessageOut()

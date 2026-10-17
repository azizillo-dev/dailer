"""Xabar yaratish va qurilmalarga yetkazish (Web Push, Expo Push)."""

import json
import logging
import uuid

import httpx
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Device, Notification, NotificationKind, Platform
from app.services.redis import redis

log = logging.getLogger(__name__)

EXPO_URL = "https://exp.host/--/api/v2/push/send"
# Testlar push yuborilishini kuzatadi
sent: list[dict] = []


def _webpush(subscription: dict, payload: dict) -> int | None:
    from pywebpush import WebPushException, webpush

    try:
        resp = webpush(
            subscription_info=subscription,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=settings.vapid_private_key,
            vapid_claims={"sub": settings.vapid_subject},
            ttl=60 * 60 * 12,
        )
        return resp.status_code
    except WebPushException as exc:
        return exc.response.status_code if exc.response is not None else None


async def _push_device(db: AsyncSession, device: Device, payload: dict) -> None:
    if settings.env == "test":
        sent.append({"device": device.id, **payload})
        return
    try:
        if device.platform == Platform.web:
            if not settings.vapid_private_key:
                return
            status = await run_in_threadpool(_webpush, json.loads(device.push_token), payload)
            if status in (404, 410):  # obuna eskirgan
                await db.execute(delete(Device).where(Device.id == device.id))
        else:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    EXPO_URL,
                    json={
                        "to": device.push_token,
                        "title": payload["title"],
                        "body": payload["body"],
                        "data": payload.get("data", {}),
                        "sound": "default",
                    },
                )
    except Exception:
        log.exception("Push yuborilmadi: device=%s", device.id)


async def send(
    db: AsyncSession,
    user_id: uuid.UUID,
    kind: NotificationKind,
    title: str,
    body: str,
    data: dict | None = None,
    dedupe_key: str | None = None,
) -> Notification | None:
    """Xabarni saqlaydi va barcha qurilmalarga yuboradi. `dedupe_key` bo'lsa — bir martalik."""
    if dedupe_key and not await redis.set(f"notif:{dedupe_key}", "1", nx=True, ex=3 * 86400):
        return None
    n = Notification(user_id=user_id, kind=kind, title=title[:160], body=body, data=data or {})
    db.add(n)
    await db.flush()
    payload = {"title": n.title, "body": n.body, "data": {**(data or {}), "notification_id": str(n.id), "kind": kind.value}}
    devices = (await db.scalars(select(Device).where(Device.user_id == user_id))).all()
    for d in devices:
        await _push_device(db, d, payload)
    await db.commit()
    return n

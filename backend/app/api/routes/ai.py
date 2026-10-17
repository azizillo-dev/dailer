import json
import time
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.core.errors import AppError
from app.core.security import now
from app.db.session import SessionLocal
from app.models import AIConversation, AIMessage, AIReport, AIReportKind, AIRole
from app.services import stats as st
from app.services.ai import fallback, prompts
from app.services.ai import router as ai
from app.services.ai.context import build_context
from app.services.redis import redis
from app.services.schedule import local_today

router = APIRouter(prefix="/ai", tags=["ai"])

DAILY_LIMIT = 15
HISTORY = 6
CHAT_MAX_TOKENS = 350
REPORT_MAX_TOKENS = 800


def _usage_key(user) -> str:
    return f"ai:user:{user.id}:{local_today(user.profile.timezone)}"


def _reset_at(user) -> datetime:
    tz = ZoneInfo(user.profile.timezone)
    tomorrow = local_today(user.profile.timezone) + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=tz)


@router.get("/usage")
async def usage(user: CurrentUser):
    used = int(await redis.get(_usage_key(user)) or 0)
    return {"used": used, "limit": DAILY_LIMIT, "resets_at": _reset_at(user)}


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    conversation_id: uuid.UUID | None = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.post("/chat")
async def chat(body: ChatIn, db: DB, user: CurrentUser):
    used = int(await redis.get(_usage_key(user)) or 0)
    if used >= DAILY_LIMIT:
        raise AppError("ai_limit_reached", 429)

    if body.conversation_id:
        conv = await db.get(AIConversation, body.conversation_id)
        if conv is None or conv.user_id != user.id:
            raise AppError("not_found", 404)
    else:
        conv = AIConversation(user_id=user.id, title=body.message.strip()[:60])
        db.add(conv)
        await db.flush()

    history = (
        await db.scalars(
            select(AIMessage)
            .where(AIMessage.conversation_id == conv.id)
            .order_by(AIMessage.created_at.desc())
            .limit(HISTORY)
        )
    ).all()
    db.add(AIMessage(conversation_id=conv.id, role=AIRole.user, content=body.message.strip()))
    conv.last_message_at = now()
    await db.commit()

    context = await build_context(db, user)
    lang = user.profile.language.value
    messages = [{"role": "system", "content": prompts.chat_system(lang, context)}]
    messages += [{"role": m.role.value, "content": m.content} for m in reversed(history)]
    messages.append({"role": "user", "content": body.message.strip()})
    conv_id, user_key = conv.id, _usage_key(user)

    async def events():
        yield _sse("meta", {"conversation_id": conv_id})
        parts: list[str] = []
        start = None
        began = time.monotonic()
        # So'rov sessiyasi javob oqimi davomida yopilishi mumkin — alohida sessiya
        async with SessionLocal() as s:
            async for piece in ai.stream_chat(s, messages, CHAT_MAX_TOKENS):
                if isinstance(piece, ai.Start):
                    start = piece
                    continue
                parts.append(piece)
                yield _sse("token", {"t": piece})

            if start is None:
                text = fallback.analysis(context, lang)
                # Shablon javob ham "yozilayotgandek" ko'rinsin — bo'laklab
                for i in range(0, len(text), 24):
                    yield _sse("token", {"t": text[i : i + 24]})
                parts = [text]
            else:
                # Limit faqat haqiqiy AI javobi uchun sarflanadi
                await redis.incr(user_key)
                await redis.expire(user_key, 2 * 86400)

            msg = AIMessage(
                conversation_id=conv_id,
                role=AIRole.assistant,
                content="".join(parts).strip(),
                provider_code=start.provider if start else "template",
                model=start.model if start else None,
                latency_ms=int((time.monotonic() - began) * 1000),
                fallback_level=start.level if start else -1,
            )
            s.add(msg)
            await s.commit()
            yield _sse("done", {"message_id": msg.id, "provider": msg.provider_code})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/conversations")
async def conversations(db: DB, user: CurrentUser):
    rows = await db.scalars(
        select(AIConversation)
        .where(AIConversation.user_id == user.id)
        .order_by(AIConversation.last_message_at.desc())
        .limit(30)
    )
    return [{"id": c.id, "title": c.title, "last_message_at": c.last_message_at} for c in rows]


@router.get("/conversations/{conv_id}")
async def conversation(conv_id: uuid.UUID, db: DB, user: CurrentUser):
    conv = await db.get(AIConversation, conv_id)
    if conv is None or conv.user_id != user.id:
        raise AppError("not_found", 404)
    msgs = await db.scalars(
        select(AIMessage).where(AIMessage.conversation_id == conv.id).order_by(AIMessage.created_at)
    )
    return {
        "id": conv.id,
        "title": conv.title,
        "messages": [
            {"id": m.id, "role": m.role.value, "content": m.content, "provider": m.provider_code,
             "rating": m.rating, "created_at": m.created_at}
            for m in msgs
        ],
    }


@router.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(conv_id: uuid.UUID, db: DB, user: CurrentUser):
    conv = await db.get(AIConversation, conv_id)
    if conv is None or conv.user_id != user.id:
        raise AppError("not_found", 404)
    await db.delete(conv)
    await db.commit()
    return Response(status_code=204)


class RateIn(BaseModel):
    rating: int = Field(ge=-1, le=1)


@router.post("/messages/{message_id}/rate", status_code=204)
async def rate(message_id: uuid.UUID, body: RateIn, db: DB, user: CurrentUser):
    msg = await db.get(AIMessage, message_id)
    conv = await db.get(AIConversation, msg.conversation_id) if msg else None
    if msg is None or conv is None or conv.user_id != user.id or msg.role != AIRole.assistant:
        raise AppError("not_found", 404)
    msg.rating = body.rating or None
    await db.commit()
    return Response(status_code=204)


def _report_out(r: AIReport) -> dict:
    return {
        "id": r.id, "kind": r.kind.value, "period_start": r.period_start, "period_end": r.period_end,
        "content": r.content, "provider": r.provider_code, "stats": r.stats_snapshot, "created_at": r.created_at,
    }


@router.post("/reports/weekly")
async def weekly_report(db: DB, user: CurrentUser, response: Response):
    """Haftada bir marta. Shu hafta uchun hisobot bor bo'lsa — o'sha qaytariladi."""
    today = local_today(user.profile.timezone)
    week = st.week_start(today)
    existing = await db.scalar(
        select(AIReport).where(
            AIReport.user_id == user.id, AIReport.kind == AIReportKind.weekly, AIReport.period_start == week
        )
    )
    # Shablon hisobotni (AI band bo'lgan paytdagi) qayta urinib ko'rish mumkin
    if existing and existing.provider_code != "template":
        return _report_out(existing)

    context = await build_context(db, user)
    lang = user.profile.language.value
    result = await ai.complete(
        db,
        [
            {"role": "system", "content": prompts.report_system(lang, context)},
            {"role": "user", "content": "Haftalik hisobotimni yozing."},
        ],
        REPORT_MAX_TOKENS,
    )
    content, provider = (result[0], result[1].provider) if result and result[0] else (fallback.analysis(context, lang), "template")

    if existing:
        existing.content, existing.provider_code, existing.stats_snapshot = content, provider, context
        existing.period_end = today
        report = existing
    else:
        report = AIReport(
            user_id=user.id, kind=AIReportKind.weekly, period_start=week, period_end=today,
            stats_snapshot=context, content=content, provider_code=provider,
        )
        db.add(report)
    await db.commit()
    await db.refresh(report)
    response.status_code = 201
    return _report_out(report)


@router.get("/reports")
async def reports(db: DB, user: CurrentUser):
    rows = await db.scalars(
        select(AIReport).where(AIReport.user_id == user.id).order_by(AIReport.period_start.desc()).limit(20)
    )
    return [_report_out(r) for r in rows]

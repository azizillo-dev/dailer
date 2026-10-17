import uuid

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import client_ip
from app.models import AuditLog, User


def _jsonable(v):
    if isinstance(v, uuid.UUID):
        return str(v)
    if hasattr(v, "isoformat"):
        return v.isoformat()
    if hasattr(v, "value"):
        return v.value
    if isinstance(v, dict):
        return {k: _jsonable(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_jsonable(x) for x in v]
    return v


def record(
    db: AsyncSession,
    actor: User,
    action: str,
    entity: str,
    entity_id=None,
    diff: dict | None = None,
    request: Request | None = None,
) -> None:
    """Admin amallarini yozib boradi (commit chaqiruvchi tomonda)."""
    db.add(
        AuditLog(
            actor_id=actor.id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            diff=_jsonable(diff or {}),
            ip=client_ip(request) if request else None,
        )
    )

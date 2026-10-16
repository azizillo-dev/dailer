import base64
import hashlib
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from cryptography.fernet import Fernet

from app.core.config import settings

_hasher = PasswordHasher()
_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.encryption_key.encode()).digest()))

JWT_ALG = "HS256"
_PASSWORD_RE = re.compile(r"^(?=.*[A-Za-zА-Яа-яЁё])(?=.*\d).{8,128}$")


def now() -> datetime:
    return datetime.now(UTC)


# --- Parollar ---

def is_strong_password(password: str) -> bool:
    return bool(_PASSWORD_RE.match(password))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


# --- JWT ---

def create_access_token(user_id: uuid.UUID, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": now() + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALG)


def create_mfa_token(user_id: uuid.UUID) -> str:
    """Parol to'g'ri, lekin 2FA kodi hali kiritilmagan bosqich uchun."""
    payload = {
        "sub": str(user_id),
        "type": "mfa",
        "exp": now() + timedelta(minutes=settings.mfa_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALG)


def decode_token(token: str, expected_type: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        return None


# --- Tasodifiy tokenlar (refresh, email havolalari) ---

def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- Shifrlash (2FA secret) ---

def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()

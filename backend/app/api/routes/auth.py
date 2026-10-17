import secrets
from datetime import timedelta

import pyotp
from fastapi import APIRouter, Request
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, client_ip
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    create_mfa_token,
    decode_token,
    decrypt,
    encrypt,
    hash_password,
    hash_token,
    is_strong_password,
    now,
    verify_password,
)
from app.models import EmailTokenPurpose, User, User2FA, UserStatus
from app.schemas.auth import (
    BackupCodesOut,
    ChangePasswordIn,
    EmailIn,
    GoogleIn,
    LoginIn,
    LoginOut,
    MessageOut,
    RefreshIn,
    RegisterIn,
    ResetPasswordIn,
    TokenIn,
    TokenPair,
    TwoFactorConfirmIn,
    TwoFactorSetupOut,
    TwoFactorVerifyIn,
)
from app.services import email as mailer
from app.services import tokens
from app.services.google import verify_google_token
from app.services.redis import rate_limit
from app.services.users import get_by_email, mark_email_verified, new_user

router = APIRouter(prefix="/auth", tags=["auth"])

# Mavjud bo'lmagan email bilan kirishda ham parol tekshiruvi vaqti bir xil bo'lsin
_DUMMY_HASH = hash_password("dummy-password-1")


def _ua(request: Request) -> str | None:
    return request.headers.get("user-agent")


async def _send_verification(db: DB, user: User) -> None:
    raw = await tokens.create_email_token(
        db, user, EmailTokenPurpose.verify_email, timedelta(hours=settings.verify_email_hours)
    )
    await mailer.send_template(
        "verify_email",
        user.email,
        user.profile.language.value,
        user.profile.full_name,
        f"{settings.web_url}/verify-email?token={raw}",
    )


async def _login_result(db: DB, user: User, request: Request) -> LoginOut:
    if user.status == UserStatus.blocked:
        raise AppError("account_blocked", 403)
    if user.status == UserStatus.pending_deletion:
        # 30 kun ichida qayta kirdi — o'chirish bekor qilinadi
        user.status = UserStatus.active
        user.deletion_requested_at = None
    user.last_seen_at = now()
    if user.is_admin and user.has_2fa:
        await db.commit()
        return LoginOut(requires_2fa=True, mfa_token=create_mfa_token(user.id))
    pair = await tokens.issue_token_pair(db, user, _ua(request))
    return LoginOut(tokens=pair, requires_2fa_setup=user.is_admin and not user.has_2fa)


@router.post("/register", response_model=LoginOut, status_code=201)
async def register(body: RegisterIn, db: DB, request: Request):
    await rate_limit(f"register:{client_ip(request)}", 10, 3600)
    if not is_strong_password(body.password):
        raise AppError("weak_password", 422)
    if await get_by_email(db, body.email):
        raise AppError("email_taken", 409)

    user = new_user(body.email, body.full_name, body.language, hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await _send_verification(db, user)
    return await _login_result(db, user, request)


@router.post("/login", response_model=LoginOut)
async def login(body: LoginIn, db: DB, request: Request):
    await rate_limit(f"login:{client_ip(request)}", 20, 300)
    await rate_limit(f"login:{body.email.lower()}", 10, 300)

    user = await get_by_email(db, body.email)
    if user is None:
        verify_password(body.password, _DUMMY_HASH)
        raise AppError("invalid_credentials", 401)
    if not verify_password(body.password, user.password_hash):
        raise AppError("invalid_credentials", 401)
    return await _login_result(db, user, request)


@router.post("/google", response_model=LoginOut)
async def google(body: GoogleIn, db: DB, request: Request):
    await rate_limit(f"google:{client_ip(request)}", 20, 300)
    identity = await verify_google_token(body.id_token)

    user = await db.scalar(select(User).where(User.google_sub == identity.sub))
    if user is None:
        user = await get_by_email(db, identity.email)
        if user is not None:
            # Google tasdiqlagan bo'lsagina mavjud akkauntga ulaymiz
            if not identity.email_verified:
                raise AppError("google_auth_failed", 401)
            user.google_sub = identity.sub
        else:
            user = new_user(identity.email, identity.name, body.language)
            user.google_sub = identity.sub
            if identity.picture:
                user.profile.avatar_url = identity.picture
            db.add(user)

    if identity.email_verified:
        mark_email_verified(user)
    await db.commit()
    await db.refresh(user)
    return await _login_result(db, user, request)


@router.post("/2fa/verify", response_model=TokenPair)
async def verify_2fa(body: TwoFactorVerifyIn, db: DB, request: Request):
    user_id = decode_token(body.mfa_token, "mfa")
    if user_id is None:
        raise AppError("token_expired", 401)
    await rate_limit(f"2fa:{user_id}", 5, 300)

    user = await db.get(User, user_id)
    if user is None or not user.has_2fa:
        raise AppError("invalid_token", 401)

    code = body.code.replace(" ", "").strip()
    tf = user.two_factor
    ok = pyotp.TOTP(decrypt(tf.totp_secret_encrypted)).verify(code, valid_window=1)
    if not ok:
        # Zaxira kod — bir martalik
        hashed = hash_token(code.lower())
        if hashed in tf.backup_codes_hash:
            tf.backup_codes_hash = [h for h in tf.backup_codes_hash if h != hashed]
            ok = True
    if not ok:
        raise AppError("invalid_2fa_code", 401)

    return await tokens.issue_token_pair(db, user, _ua(request))


@router.post("/2fa/setup", response_model=TwoFactorSetupOut)
async def setup_2fa(user: CurrentUser, db: DB):
    secret = pyotp.random_base32()
    if user.two_factor is None:
        user.two_factor = User2FA(totp_secret_encrypted=encrypt(secret))
    else:
        # Qayta sozlash: yangi secret, tasdiqlanguncha eski kod ishlamaydi
        user.two_factor.totp_secret_encrypted = encrypt(secret)
        user.two_factor.enabled_at = None
        user.two_factor.backup_codes_hash = []
    await db.commit()
    url = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="Dailer")
    return TwoFactorSetupOut(secret=secret, otpauth_url=url)


@router.post("/2fa/confirm", response_model=BackupCodesOut)
async def confirm_2fa(body: TwoFactorConfirmIn, user: CurrentUser, db: DB):
    tf = user.two_factor
    if tf is None:
        raise AppError("2fa_not_setup", 400)
    if not pyotp.TOTP(decrypt(tf.totp_secret_encrypted)).verify(body.code, valid_window=1):
        raise AppError("invalid_2fa_code", 400)

    codes = [secrets.token_hex(4) for _ in range(8)]
    tf.backup_codes_hash = [hash_token(c) for c in codes]
    tf.enabled_at = now()
    await db.commit()
    return BackupCodesOut(backup_codes=codes)


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshIn, db: DB, request: Request):
    _, pair = await tokens.rotate_refresh_token(db, body.refresh_token, _ua(request))
    return pair


@router.post("/logout", response_model=MessageOut)
async def logout(body: RefreshIn, db: DB):
    await tokens.revoke_refresh_token(db, body.refresh_token)
    return MessageOut()


@router.post("/logout-all", response_model=MessageOut)
async def logout_all(user: CurrentUser, db: DB):
    await tokens.revoke_all_for_user(db, user.id)
    return MessageOut()


@router.post("/verify-email", response_model=MessageOut)
async def verify_email(body: TokenIn, db: DB):
    user = await tokens.consume_email_token(db, body.token, EmailTokenPurpose.verify_email)
    mark_email_verified(user)
    await db.commit()
    return MessageOut()


@router.post("/resend-verification", response_model=MessageOut)
async def resend_verification(user: CurrentUser, db: DB):
    if user.email_verified_at is not None:
        raise AppError("already_verified", 400)
    await rate_limit(f"resend:{user.id}", 3, 3600)
    await _send_verification(db, user)
    return MessageOut()


@router.post("/forgot-password", response_model=MessageOut)
async def forgot_password(body: EmailIn, db: DB, request: Request):
    await rate_limit(f"forgot:{client_ip(request)}", 10, 3600)
    await rate_limit(f"forgot:{body.email.lower()}", 3, 3600)

    # Email mavjud-mavjud emasligini oshkor qilmaymiz — javob doim bir xil
    user = await get_by_email(db, body.email)
    if user is not None and user.status != UserStatus.blocked:
        raw = await tokens.create_email_token(
            db,
            user,
            EmailTokenPurpose.reset_password,
            timedelta(minutes=settings.reset_password_minutes),
        )
        await mailer.send_template(
            "reset_password",
            user.email,
            user.profile.language.value,
            user.profile.full_name,
            f"{settings.web_url}/reset-password?token={raw}",
        )
    return MessageOut()


@router.post("/reset-password", response_model=MessageOut)
async def reset_password(body: ResetPasswordIn, db: DB):
    if not is_strong_password(body.password):
        raise AppError("weak_password", 422)
    user = await tokens.consume_email_token(db, body.token, EmailTokenPurpose.reset_password)
    user.password_hash = hash_password(body.password)
    # Havolani bosgan — emailga egalik qilishini isbotladi
    mark_email_verified(user)
    await db.commit()
    await tokens.revoke_all_for_user(db, user.id)
    return MessageOut()


@router.post("/change-password", response_model=TokenPair)
async def change_password(body: ChangePasswordIn, user: CurrentUser, db: DB, request: Request):
    if user.password_hash is not None and not verify_password(
        body.current_password or "", user.password_hash
    ):
        raise AppError("wrong_password", 400)
    if not is_strong_password(body.new_password):
        raise AppError("weak_password", 422)
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    # Boshqa qurilmalardagi sessiyalar yopiladi, joriy qurilma yangi token oladi
    await tokens.revoke_all_for_user(db, user.id)
    return await tokens.issue_token_pair(db, user, _ua(request))

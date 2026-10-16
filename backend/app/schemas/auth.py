from pydantic import BaseModel, EmailStr, Field

from app.models import Language


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    language: Language = Language.uz


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleIn(BaseModel):
    id_token: str
    language: Language = Language.uz


class RefreshIn(BaseModel):
    refresh_token: str


class TwoFactorVerifyIn(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=16)


class TwoFactorConfirmIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class EmailIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str


class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordIn(BaseModel):
    # Google orqali kirganlarda joriy parol yo'q
    current_password: str | None = None
    new_password: str = Field(min_length=8, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginOut(BaseModel):
    """Oddiy foydalanuvchi uchun — tokenlar. Admin uchun — avval 2FA."""

    tokens: TokenPair | None = None
    requires_2fa: bool = False
    # Admin hali 2FA sozlamagan: tokenlar beriladi, lekin admin API'lari yopiq
    requires_2fa_setup: bool = False
    mfa_token: str | None = None


class TwoFactorSetupOut(BaseModel):
    secret: str
    otpauth_url: str


class BackupCodesOut(BaseModel):
    backup_codes: list[str]


class MessageOut(BaseModel):
    ok: bool = True

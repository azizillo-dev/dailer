from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"

    database_url: str = "postgresql+asyncpg://dailer:dailer@localhost:5433/dailer"
    # Bepul Postgres (Supabase pooler) ulanishlar sonini cheklaydi
    db_pool_size: int = 5
    db_max_overflow: int = 10
    # Serverless (Vercel): har so'rov o'z ulanishi, pool saqlanmaydi
    db_null_pool: bool = False
    # Neon integratsiyasi: pooler'siz to'g'ridan-to'g'ri manzil (asyncpg prepared statement'lari uchun)
    database_url_unpooled: str = ""
    # Bo'sh — Redis'siz (bitta server uchun xotiradagi o'rinbosar; bepul hostingda)
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-secret-change-me"
    encryption_key: str = "dev-encryption-key-change-me"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    # 2FA bosqichidagi vaqtinchalik token
    mfa_token_minutes: int = 5

    web_url: str = "http://localhost:3000"
    # API'ning tashqi manzili (yuklangan fayllar havolasi uchun)
    public_url: str = "http://localhost:8010"
    upload_dir: str = "uploads"
    # disk — upload_dir papkasi; db — Postgres'da (diski vaqtinchalik bo'lgan bepul hosting uchun)
    upload_storage: str = "disk"
    cors_origins: str = "http://localhost:3000"

    superadmin_email: str = "ceonabiyev@gmail.com"

    google_client_ids: str = ""

    # smtp — SMTP server (lokal Mailpit, Gmail); brevo — HTTPS API (SMTP portlari yopiq hostingda)
    email_provider: str = "smtp"
    brevo_api_key: str = ""
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_tls: bool = False
    mail_from: str = "Dailer <no-reply@dailer.uz>"

    # AI provayderlar kalitlari (bo'sh bo'lsa — o'sha provayder o'tkazib yuboriladi)
    gemini_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    deepseek_api_key: str = ""
    xai_api_key: str = ""
    ai_timeout_seconds: float = 20.0

    # Web Push (VAPID). Yaratish: python -m scripts.gen_vapid
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:ceonabiyev@gmail.com"

    # Tashqi cron /internal/cron'ni chaqiradi: X-Cron-Secret kaliti yoki GitHub Actions OIDC tokeni
    cron_secret: str = ""
    # "egasi/repo" — shu repodagi GitHub Actions'ning OIDC tokeni qabul qilinadi (kalitsiz)
    cron_github_repo: str = ""
    # Cron necha daqiqada bir chaqiriladi (vazifalar shu oynada "vaqti keldi" deb hisoblanadi)
    cron_window_min: int = 1

    verify_email_hours: int = 48
    reset_password_minutes: int = 30

    @field_validator("database_url", "database_url_unpooled")
    @classmethod
    def _asyncpg_url(cls, v: str) -> str:
        """Neon/Render beradigan postgres://...?sslmode=require manzilini asyncpg'ga moslaydi."""
        if not v:
            return v
        parts = urlsplit(v)
        scheme = parts.scheme
        if scheme in ("postgres", "postgresql"):
            scheme = "postgresql+asyncpg"
        query = dict(parse_qsl(parts.query))
        if "sslmode" in query:
            mode = query.pop("sslmode")
            if mode != "disable":
                query["ssl"] = "require"
        query.pop("channel_binding", None)  # asyncpg qo'llamaydi
        return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    @property
    def db_url(self) -> str:
        return self.database_url_unpooled or self.database_url

    @property
    def is_dev(self) -> bool:
        return self.env == "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def google_client_id_list(self) -> list[str]:
        return [c.strip() for c in self.google_client_ids.split(",") if c.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"

    database_url: str = "postgresql+asyncpg://dailer:dailer@localhost:5433/dailer"
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
    cors_origins: str = "http://localhost:3000"

    superadmin_email: str = "ceonabiyev@gmail.com"

    google_client_ids: str = ""

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

    verify_email_hours: int = 48
    reset_password_minutes: int = 30

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

"""Server xabarlari uchun oddiy tarjima. Asosiy til — o'zbek."""

from contextvars import ContextVar

SUPPORTED = ("uz", "ru", "en")
DEFAULT_LANG = "uz"

current_lang: ContextVar[str] = ContextVar("current_lang", default=DEFAULT_LANG)


def pick_language(accept_language: str | None) -> str:
    """`Accept-Language: ru-RU,ru;q=0.9,en;q=0.8` → `ru`."""
    if not accept_language:
        return DEFAULT_LANG
    for part in accept_language.split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in SUPPORTED:
            return code
    return DEFAULT_LANG


MESSAGES: dict[str, dict[str, str]] = {
    "email_taken": {
        "uz": "Bu email bilan allaqachon ro'yxatdan o'tilgan.",
        "ru": "Этот email уже зарегистрирован.",
        "en": "This email is already registered.",
    },
    "invalid_credentials": {
        "uz": "Email yoki parol noto'g'ri.",
        "ru": "Неверный email или пароль.",
        "en": "Incorrect email or password.",
    },
    "account_blocked": {
        "uz": "Akkauntingiz bloklangan. Qo'llab-quvvatlash xizmatiga yozing.",
        "ru": "Ваш аккаунт заблокирован. Напишите в поддержку.",
        "en": "Your account is blocked. Please contact support.",
    },
    "invalid_token": {
        "uz": "Havola yoki token yaroqsiz.",
        "ru": "Ссылка или токен недействительны.",
        "en": "The link or token is invalid.",
    },
    "token_expired": {
        "uz": "Havolaning muddati tugagan. Qaytadan so'rang.",
        "ru": "Срок действия ссылки истёк. Запросите новую.",
        "en": "The link has expired. Please request a new one.",
    },
    "not_authenticated": {
        "uz": "Avval tizimga kiring.",
        "ru": "Сначала войдите в систему.",
        "en": "Please sign in first.",
    },
    "forbidden": {
        "uz": "Bu amal uchun ruxsatingiz yo'q.",
        "ru": "У вас нет прав для этого действия.",
        "en": "You don't have permission to do this.",
    },
    "weak_password": {
        "uz": "Parol kamida 8 belgi, harf va raqamdan iborat bo'lsin.",
        "ru": "Пароль должен содержать минимум 8 символов, буквы и цифры.",
        "en": "Password must be at least 8 characters with letters and digits.",
    },
    "wrong_password": {
        "uz": "Joriy parol noto'g'ri.",
        "ru": "Текущий пароль неверен.",
        "en": "Current password is incorrect.",
    },
    "invalid_2fa_code": {
        "uz": "Tasdiqlash kodi noto'g'ri.",
        "ru": "Неверный код подтверждения.",
        "en": "Invalid verification code.",
    },
    "2fa_not_setup": {
        "uz": "Ikki bosqichli himoya hali sozlanmagan.",
        "ru": "Двухфакторная защита ещё не настроена.",
        "en": "Two-factor authentication is not set up yet.",
    },
    "google_not_configured": {
        "uz": "Google orqali kirish hozircha sozlanmagan.",
        "ru": "Вход через Google пока не настроен.",
        "en": "Google sign-in is not configured yet.",
    },
    "google_auth_failed": {
        "uz": "Google orqali kirib bo'lmadi. Qaytadan urinib ko'ring.",
        "ru": "Не удалось войти через Google. Попробуйте ещё раз.",
        "en": "Google sign-in failed. Please try again.",
    },
    "rate_limited": {
        "uz": "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
        "ru": "Слишком много попыток. Повторите позже.",
        "en": "Too many attempts. Please try again later.",
    },
    "already_verified": {
        "uz": "Email allaqachon tasdiqlangan.",
        "ru": "Email уже подтверждён.",
        "en": "Email is already verified.",
    },
    "validation_error": {
        "uz": "Ma'lumotlar noto'g'ri kiritilgan.",
        "ru": "Данные введены неверно.",
        "en": "Invalid input.",
    },
    "invalid_image": {
        "uz": "Rasm faylini o'qib bo'lmadi. JPG, PNG yoki WEBP yuklang.",
        "ru": "Не удалось прочитать изображение. Загрузите JPG, PNG или WEBP.",
        "en": "Couldn't read the image. Please upload a JPG, PNG or WEBP.",
    },
    "file_too_large": {
        "uz": "Fayl juda katta (ko'pi bilan 5 MB).",
        "ru": "Файл слишком большой (не более 5 МБ).",
        "en": "The file is too large (5 MB max).",
    },
    "not_found": {
        "uz": "Topilmadi.",
        "ru": "Не найдено.",
        "en": "Not found.",
    },
    "internal_error": {
        "uz": "Kutilmagan xatolik. Birozdan keyin urinib ko'ring.",
        "ru": "Непредвиденная ошибка. Попробуйте позже.",
        "en": "Unexpected error. Please try again later.",
    },
}


def t(code: str, lang: str | None = None) -> str:
    lang = lang or current_lang.get()
    entry = MESSAGES.get(code)
    if not entry:
        return code
    return entry.get(lang) or entry[DEFAULT_LANG]

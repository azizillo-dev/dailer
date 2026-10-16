import logging
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings

log = logging.getLogger(__name__)

# Testlarda yuborilgan xatlar shu yerga tushadi
outbox: list[EmailMessage] = []

_TEMPLATES = {
    "verify_email": {
        "uz": ("Emailingizni tasdiqlang", "Dailer'ga xush kelibsiz, {name}!",
               "Akkauntingizni faollashtirish uchun quyidagi tugmani bosing.", "Emailni tasdiqlash"),
        "ru": ("Подтвердите email", "Добро пожаловать в Dailer, {name}!",
               "Нажмите на кнопку ниже, чтобы активировать аккаунт.", "Подтвердить email"),
        "en": ("Confirm your email", "Welcome to Dailer, {name}!",
               "Press the button below to activate your account.", "Confirm email"),
    },
    "reset_password": {
        "uz": ("Parolni tiklash", "Salom, {name}!",
               "Parolni tiklash so'rovi keldi. Havola 30 daqiqa amal qiladi. "
               "Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.", "Yangi parol o'rnatish"),
        "ru": ("Восстановление пароля", "Здравствуйте, {name}!",
               "Мы получили запрос на сброс пароля. Ссылка действует 30 минут. "
               "Если это были не вы, просто проигнорируйте письмо.", "Установить новый пароль"),
        "en": ("Reset your password", "Hi {name}!",
               "We received a password reset request. The link is valid for 30 minutes. "
               "If it wasn't you, just ignore this email.", "Set a new password"),
    },
}

_FOOTER = "Don't forget why you started!"


def _html(heading: str, text: str, button: str, url: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;background:#F7F0E6;font-family:Arial,sans-serif;color:#2B1D14">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="100%" style="max-width:480px;background:#FFFDF9;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:bold;color:#4A3426;padding-bottom:4px">Dailer</td></tr>
<tr><td style="font-size:20px;padding:16px 0 8px">{heading}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#4A3426">{text}</td></tr>
<tr><td style="padding:28px 0">
<a href="{url}" style="background:#4A3426;color:#F7F0E6;text-decoration:none;padding:14px 24px;
border-radius:999px;font-size:15px;display:inline-block">{button}</a></td></tr>
<tr><td style="font-size:12px;color:#8A7362;word-break:break-all">{url}</td></tr>
<tr><td style="font-size:13px;color:#C08552;padding-top:24px;font-style:italic">{_FOOTER}</td></tr>
</table></td></tr></table></body></html>"""


async def send_template(kind: str, to: str, lang: str, name: str, url: str) -> None:
    subject, heading, text, button = _TEMPLATES[kind].get(lang) or _TEMPLATES[kind]["uz"]
    heading = heading.format(name=name or "")

    msg = EmailMessage()
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg["Subject"] = f"Dailer — {subject}"
    msg.set_content(f"{heading}\n\n{text}\n\n{button}: {url}\n\n{_FOOTER}")
    msg.add_alternative(_html(heading, text, button, url), subtype="html")

    if settings.env == "test":
        outbox.append(msg)
        return
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            start_tls=settings.smtp_tls,
        )
    except Exception:
        # Email yuborilmasa ham so'rov yiqilmasin — log'ga yoziladi
        log.exception("Email yuborilmadi: %s → %s", kind, to)

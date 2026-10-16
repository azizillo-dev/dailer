"""Birinchi super adminni tayinlash.

    python -m scripts.seed_superadmin                 # mavjud foydalanuvchini super admin qiladi
    python -m scripts.seed_superadmin --password XXX  # yo'q bo'lsa, shu parol bilan yaratadi

Email `.env` dagi SUPERADMIN_EMAIL dan olinadi. Kirgandan keyin 2FA sozlanmaguncha
admin API yopiq bo'ladi.
"""

import argparse
import asyncio

from app.core.config import settings
from app.core.security import hash_password, is_strong_password, now
from app.db.session import SessionLocal
from app.models import Language, UserRole
from app.services.users import get_by_email, new_user


async def main(password: str | None) -> None:
    email = settings.superadmin_email.lower()
    async with SessionLocal() as db:
        user = await get_by_email(db, email)
        if user is None:
            if not password:
                print(f"{email} topilmadi. Ro'yxatdan o'ting yoki --password bilan ishga tushiring.")
                return
            if not is_strong_password(password):
                print("Parol kamida 8 belgi, harf va raqamdan iborat bo'lsin.")
                return
            user = new_user(email, "Admin", Language.uz, hash_password(password))
            db.add(user)
        user.role = UserRole.super_admin
        user.email_verified_at = user.email_verified_at or now()
        await db.commit()
        print(f"{email} — super_admin. Endi kirib, 2FA ni sozlang.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--password")
    asyncio.run(main(parser.parse_args().password))

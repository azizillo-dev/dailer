"""Lokal sinov uchun demo foydalanuvchi: 3 haftalik tarix bilan.

    python -m scripts.seed_demo            # demo@dailer.uz / Demo12345
"""

import asyncio
import random
from datetime import UTC, datetime, time, timedelta

from sqlalchemy import delete, select

from app.core.security import hash_password, now
from app.db.session import SessionLocal
from app.models import (
    Checkin,
    CheckinStatus,
    DayReflection,
    Language,
    RoutineItem,
    TaskTemplate,
    User,
    UserType,
)
from app.services.planner import starter_plan
from app.services.schedule import local_today
from app.services.users import get_by_email, new_user

EMAIL = "demo@dailer.uz"
DAYS = 21


async def main() -> None:
    random.seed(7)
    async with SessionLocal() as db:
        old = await get_by_email(db, EMAIL)
        if old:
            await db.execute(delete(User).where(User.id == old.id))
            await db.commit()

        user = new_user(EMAIL, "Aziz Demo", Language.uz, hash_password("Demo12345"))
        user.email_verified_at = now()
        p = user.profile
        p.user_type = UserType.university_student
        p.birth_year = 2004
        p.wake_time, p.sleep_time = time(5, 0), time(23, 0)
        p.prays = True
        p.latitude, p.longitude, p.city = 41.2995, 69.2401, "Toshkent"
        p.interests = ["reading", "sport", "programming", "language"]
        p.busy_blocks = [{"label": "Darslar", "start": "08:00", "end": "12:20", "days": 31}]
        p.main_goal = "IT kompaniyada dasturchi bo'lib ishlash va oilamga yordam berish"
        p.onboarding_completed_at = now()
        db.add(user)
        await db.commit()
        await db.refresh(user)

        codes = {t.code: t.id for t in (await db.scalars(select(TaskTemplate))).all()}
        created = datetime.now(UTC) - timedelta(days=DAYS + 1)
        items = []
        for i, it in enumerate(starter_plan(p, local_today(p.timezone))):
            code = it.pop("template_code")
            it.pop("sort_order", None)
            items.append(RoutineItem(user_id=user.id, template_id=codes.get(code), sort_order=i * 10,
                                     created_at=created, **it))
        db.add_all(items)
        await db.commit()

        today = local_today(p.timezone)
        # Har bir yo'nalish uchun o'z "intizom darajasi"; vaqt o'tishi bilan yaxshilanadi
        base = {"prayer": 0.85, "sleep": 0.7, "reading": 0.5, "sport": 0.45, "study": 0.75,
                "language": 0.55, "custom": 0.6}
        stamp = now()
        for back in range(DAYS, 0, -1):
            d = today - timedelta(days=back)
            growth = (DAYS - back) / DAYS * 0.2
            # Erta uxlagan kunlar — tartib yaxshiroq (insight'lar uchun real bog'liqlik)
            early = random.random() < 0.55
            growth += 0.12 if early else -0.12
            db.add(DayReflection(
                user_id=user.id, date=d,
                mood=random.choice([4, 5]) if early else random.choice([2, 3]),
                energy=random.choice([3, 4, 5]) if early else random.choice([2, 3]),
                slept_at=time(22, random.choice([15, 30, 45])) if early else time(random.choice([0, 1]), random.choice([10, 40])),
                woke_at=time(5, random.choice([0, 10, 20])),
            ))
            for item in items:
                if not item.days_of_week & (1 << d.weekday()):
                    continue
                r = random.random()
                cat = getattr(item.category, "value", item.category)
                p_done = min(0.97, base.get(cat, 0.6) + growth)
                if r < p_done:
                    status = CheckinStatus.done
                elif r < p_done + 0.08:
                    status = CheckinStatus.partial
                elif r < p_done + 0.11:
                    status = CheckinStatus.excused
                else:
                    continue  # belgilanmagan → o'tkazilgan
                value = None
                if item.target_value:
                    value = float(item.target_value) * (1 if status == CheckinStatus.done else 0.4)
                db.add(Checkin(user_id=user.id, routine_item_id=item.id, date=d, status=status,
                               value=value, checked_at=stamp, updated_at=stamp))
        await db.commit()
        print(f"{EMAIL} / Demo12345 — {len(items)} vazifa, {DAYS} kunlik tarix")


if __name__ == "__main__":
    asyncio.run(main())

"""Boshlang'ich shablonlar katalogi. Migratsiya bazaga yozadi; keyin admin paneldan boshqariladi."""

from datetime import time

ALL = ["university_student", "school_pupil", "worker", "freelancer", "entrepreneur", "other"]
STUDENTS = ["university_student", "school_pupil"]


def _t(uz: str, ru: str, en: str) -> dict:
    return {"uz": uz, "ru": ru, "en": en}


PAGES = _t("bet", "стр.", "pages")
MINUTES = _t("daqiqa", "мин", "min")
WORDS = _t("so'z", "слов", "words")

TEMPLATES: list[dict] = [
    # Namozlar — vaqt avtomatik
    {"code": "prayer_fajr", "category": "prayer", "prayer_name": "fajr", "icon": "sunrise",
     "title": _t("Bomdod namozi", "Фаджр (утренний намаз)", "Fajr prayer"), "default_duration_min": 15},
    {"code": "prayer_dhuhr", "category": "prayer", "prayer_name": "dhuhr", "icon": "sun",
     "title": _t("Peshin namozi", "Зухр (полуденный намаз)", "Dhuhr prayer"), "default_duration_min": 15},
    {"code": "prayer_asr", "category": "prayer", "prayer_name": "asr", "icon": "sun-dim",
     "title": _t("Asr namozi", "Аср (послеполуденный намаз)", "Asr prayer"), "default_duration_min": 15},
    {"code": "prayer_maghrib", "category": "prayer", "prayer_name": "maghrib", "icon": "sunset",
     "title": _t("Shom namozi", "Магриб (вечерний намаз)", "Maghrib prayer"), "default_duration_min": 15},
    {"code": "prayer_isha", "category": "prayer", "prayer_name": "isha", "icon": "moon",
     "title": _t("Xufton namozi", "Иша (ночной намаз)", "Isha prayer"), "default_duration_min": 15},

    # Uyqu
    {"code": "wake_up", "category": "sleep", "icon": "alarm", "default_time": time(5, 0),
     "title": _t("Erta uyg'onish", "Ранний подъём", "Wake up early"),
     "description": _t("Kun shu yerdan boshlanadi.", "День начинается здесь.", "The day starts here.")},
    {"code": "sleep", "category": "sleep", "icon": "bed", "default_time": time(23, 0),
     "title": _t("Uyquga yotish", "Отбой", "Go to bed"),
     "description": _t("Telefonni chetga qo'ying.", "Отложите телефон.", "Put the phone away.")},

    # Kitob va Qur'on
    {"code": "reading", "category": "reading", "icon": "book", "default_time": time(5, 45),
     "default_duration_min": 30, "default_target": 20, "unit": PAGES,
     "min_version": _t("kamida 2 bet", "хотя бы 2 страницы", "at least 2 pages"),
     "title": _t("Kitob o'qish", "Чтение книги", "Reading")},
    {"code": "quran", "category": "quran", "icon": "book-open", "default_time": time(5, 30),
     "default_duration_min": 15, "default_target": 2, "unit": PAGES,
     "min_version": _t("kamida 1 oyat", "хотя бы 1 аят", "at least 1 verse"),
     "title": _t("Qur'on o'qish", "Чтение Корана", "Quran reading")},
    {"code": "dhikr_morning", "category": "dhikr", "icon": "sparkle", "default_time": time(6, 0),
     "default_duration_min": 10, "title": _t("Ertalabki zikr", "Утренний зикр", "Morning dhikr")},

    # Sport va salomatlik
    {"code": "morning_exercise", "category": "sport", "icon": "activity", "default_time": time(6, 15),
     "default_duration_min": 15, "min_version": _t("kamida 10 ta o'tirib-turish", "хотя бы 10 приседаний", "at least 10 squats"),
     "title": _t("Ertalabki mashq", "Утренняя зарядка", "Morning exercise")},
    {"code": "workout", "category": "sport", "icon": "dumbbell", "default_time": time(18, 0),
     "default_duration_min": 45, "min_version": _t("kamida 10 daqiqa yurish", "хотя бы 10 минут ходьбы", "at least a 10-minute walk"),
     "title": _t("Sport / yugurish", "Спорт / пробежка", "Workout / run")},
    {"code": "water", "category": "health", "icon": "droplet", "default_target": 8,
     "unit": _t("stakan", "стаканов", "glasses"), "title": _t("Suv ichish", "Пить воду", "Drink water")},
    {"code": "no_phone", "category": "health", "icon": "phone-off", "default_time": time(22, 0),
     "default_duration_min": 60, "title": _t("Telefonsiz 1 soat", "Час без телефона", "One hour without phone")},

    # O'qish va ish
    {"code": "homework", "category": "study", "icon": "graduation", "default_time": time(15, 0),
     "default_duration_min": 60, "suitable_for": STUDENTS,
     "title": _t("Dars tayyorlash", "Подготовка уроков", "Homework")},
    {"code": "course_task", "category": "study", "icon": "laptop", "default_time": time(16, 30),
     "default_duration_min": 60, "title": _t("Kurs vazifasi", "Задание курса", "Course assignment")},
    {"code": "coding", "category": "study", "icon": "code", "default_time": time(20, 0),
     "default_duration_min": 60, "title": _t("Dasturlash amaliyoti", "Практика программирования", "Coding practice")},
    {"code": "math", "category": "study", "icon": "sigma", "default_time": time(17, 0),
     "default_duration_min": 45, "title": _t("Matematika masalalari", "Задачи по математике", "Math problems")},
    {"code": "deep_work", "category": "work", "icon": "target", "default_time": time(9, 0),
     "default_duration_min": 90, "suitable_for": ["worker", "freelancer", "entrepreneur"],
     "title": _t("Chuqur ish (fokus)", "Глубокая работа", "Deep work")},

    # Til
    {"code": "vocabulary", "category": "language", "icon": "languages", "default_time": time(20, 30),
     "default_duration_min": 20, "default_target": 15, "unit": WORDS,
     "min_version": _t("kamida 5 ta so'z", "хотя бы 5 слов", "at least 5 words"),
     "title": _t("So'z yodlash", "Учить слова", "Learn vocabulary")},
    {"code": "listening", "category": "language", "icon": "headphones", "default_duration_min": 20,
     "title": _t("Tinglab tushunish", "Аудирование", "Listening practice")},

    # Rejalashtirish
    {"code": "plan_day", "category": "custom", "icon": "list", "default_time": time(6, 30),
     "default_duration_min": 5, "title": _t("Kun rejasini ko'rib chiqish", "Просмотреть план дня", "Review today's plan")},
    {"code": "reflection", "category": "custom", "icon": "pen", "default_time": time(22, 30),
     "default_duration_min": 10, "title": _t("Kechki refleksiya", "Вечерняя рефлексия", "Evening reflection"),
     "description": _t("Bugun nima yaxshi o'tdi? Ertaga nimani yaxshilayman?",
                       "Что сегодня получилось? Что улучшу завтра?",
                       "What went well today? What will I improve tomorrow?")},
]

for i, tpl in enumerate(TEMPLATES):
    tpl.setdefault("sort_order", i * 10)
    tpl.setdefault("suitable_for", ALL)
    tpl.setdefault("description", {})

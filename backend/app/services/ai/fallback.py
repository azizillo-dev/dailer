"""AI provayderlar ishlamaganda — statistikaga asoslangan shablon javob (uz/ru/en)."""

CAT = {
    "uz": {"prayer": "namoz", "reading": "kitob o'qish", "sport": "sport", "study": "o'qish", "language": "til",
           "quran": "Qur'on", "dhikr": "zikr", "sleep": "uyqu rejimi", "health": "salomatlik", "work": "ish",
           "custom": "boshqa vazifalar"},
    "ru": {"prayer": "намаз", "reading": "чтение", "sport": "спорт", "study": "учёба", "language": "язык",
           "quran": "Коран", "dhikr": "зикр", "sleep": "режим сна", "health": "здоровье", "work": "работа",
           "custom": "другие задачи"},
    "en": {"prayer": "prayer", "reading": "reading", "sport": "sport", "study": "study", "language": "language",
           "quran": "Quran", "dhikr": "dhikr", "sleep": "sleep routine", "health": "health", "work": "work",
           "custom": "other tasks"},
}

T = {
    "uz": {
        "no_data": "Hali yetarli ma'lumot yo'q. Bir necha kun vazifalarni belgilab boring — keyin aniq tahlil beraman. "
                   "Boshlash uchun eng oson qadam: ertaga bitta vazifani albatta bajaring.",
        "score": "So'nggi 7 kunda kun tartibingizning {score}% ini bajardingiz",
        "up": ", bu o'tgan haftadan {d} ball yuqori — zo'r!",
        "down": ", bu o'tgan haftadan {d} ball past. Xavotir olmang, qayta tiklash mumkin.",
        "same": ".",
        "best": " Eng kuchli tomoningiz — {cat} ({s}%).",
        "weak": " Ko'proq e'tibor kerak: {cat} ({s}%).",
        "missed": " \"{title}\" oxirgi haftada {n} kun o'tib ketgan{at}.",
        "at": " ({t} da)",
        "step_missed": " Taklif: \"{title}\" ni minimal versiyada bajarib ko'ring — 5 daqiqa ham hisobga kiradi.",
        "step_weak": " Taklif: ertaga {cat} uchun bitta kichik, aniq vaqt belgilang.",
        "step_ok": " Taklif: shu ritmni saqlang va ertaga bitta yangi kichik odat qo'shing.",
        "streak": " Ketma-ket {n} kun — zanjirni uzmang!",
        "note": "\n\n(AI hozircha band, bu javob statistikangiz asosida tuzildi.)",
    },
    "ru": {
        "no_data": "Пока недостаточно данных. Отмечайте задачи несколько дней — и я дам точный анализ. "
                   "Самый простой первый шаг: завтра обязательно выполните одну задачу.",
        "score": "За последние 7 дней вы выполнили {score}% распорядка",
        "up": ", это на {d} пунктов выше прошлой недели — отлично!",
        "down": ", это на {d} пунктов ниже прошлой недели. Ничего страшного, всё можно вернуть.",
        "same": ".",
        "best": " Ваша сильная сторона — {cat} ({s}%).",
        "weak": " Нужно больше внимания: {cat} ({s}%).",
        "missed": " «{title}» на прошлой неделе пропущено {n} дн.{at}.",
        "at": " (в {t})",
        "step_missed": " Совет: попробуйте выполнить «{title}» в минимальной версии — даже 5 минут засчитываются.",
        "step_weak": " Совет: назначьте на завтра одно маленькое конкретное время для направления «{cat}».",
        "step_ok": " Совет: сохраните этот ритм и добавьте завтра одну маленькую новую привычку.",
        "streak": " {n} дней подряд — не рвите цепочку!",
        "note": "\n\n(ИИ сейчас занят, ответ составлен по вашей статистике.)",
    },
    "en": {
        "no_data": "There isn't enough data yet. Check off your tasks for a few days and I'll give you a precise analysis. "
                   "Easiest first step: make sure you complete one task tomorrow.",
        "score": "Over the last 7 days you completed {score}% of your routine",
        "up": ", that's {d} points above last week — great!",
        "down": ", that's {d} points below last week. Don't worry, you can bounce back.",
        "same": ".",
        "best": " Your strongest area is {cat} ({s}%).",
        "weak": " Needs more attention: {cat} ({s}%).",
        "missed": " \"{title}\" was missed on {n} days last week{at}.",
        "at": " (at {t})",
        "step_missed": " Suggestion: try the minimum version of \"{title}\" — even 5 minutes counts.",
        "step_weak": " Suggestion: set one small, specific time for {cat} tomorrow.",
        "step_ok": " Suggestion: keep this rhythm and add one small new habit tomorrow.",
        "streak": " {n} days in a row — don't break the chain!",
        "note": "\n\n(The AI is busy right now; this answer is based on your stats.)",
    },
}


def analysis(context: dict, lang: str, note: bool = True) -> str:
    lang = lang if lang in T else "uz"
    t, cats = T[lang], CAT[lang]
    w = context.get("last_7_days", {})
    score = w.get("score")
    if score is None:
        return t["no_data"] + (t["note"] if note else "")

    out = t["score"].format(score=round(score))
    prev = w.get("prev_7_days_score")
    if prev is not None and abs(score - prev) >= 1:
        out += (t["up"] if score > prev else t["down"]).format(d=round(abs(score - prev)))
    else:
        out += t["same"]

    by_cat = {k: v for k, v in (w.get("by_category") or {}).items() if v is not None}
    # "Boshqa" va uyqu — maqtash uchun noaniq; boshqa yo'nalish bo'lsa, ular tanlanmaydi
    meaningful = {k: v for k, v in by_cat.items() if k not in ("custom", "sleep")} or by_cat
    if by_cat:
        best = max(meaningful, key=meaningful.get)
        weak = min(by_cat, key=by_cat.get)
        out += t["best"].format(cat=cats.get(best, best), s=round(by_cat[best]))
        if weak != best and by_cat[weak] < 70:
            out += t["weak"].format(cat=cats.get(weak, weak), s=round(by_cat[weak]))
    else:
        weak = None

    missed = context.get("most_missed") or []
    if missed:
        m = missed[0]
        at = t["at"].format(t=m["usual_time"]) if m.get("usual_time") else ""
        out += t["missed"].format(title=m["title"], n=m["missed_days"], at=at)
        out += t["step_missed"].format(title=m["title"])
    elif weak and by_cat.get(weak, 100) < 70:
        out += t["step_weak"].format(cat=cats.get(weak, weak))
    else:
        out += t["step_ok"]

    streak = (context.get("streak") or {}).get("current", 0)
    if streak >= 3:
        out += t["streak"].format(n=streak)
    return out + (t["note"] if note else "")

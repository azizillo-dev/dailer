# 03 — API (FastAPI)

Prefiks: `/api/v1`. Format: JSON. Auth: `Authorization: Bearer <access_token>`. Til: `Accept-Language: uz|ru|en` (xato xabarlari va kontent shu tilda).

Belgilar: 🟢 v1 · 🟡 v1.5 · 🔵 v2 · 🔒 admin

**Umumiy qoidalar**
- Ro'yxatlar: `?cursor=&limit=` (cursor pagination).
- Xato formati: `{"error": {"code": "ai_limit_reached", "message": "..."}}`.
- Rate limit: auth endpointlari — IP bo'yicha 10/daq; qolganlari — foydalanuvchi bo'yicha 120/daq.
- Yozish endpointlari `client_id` qabul qiladi — offline'dan qayta yuborilsa ikki marta yozilmaydi.

---

## Auth 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| POST | `/auth/register` | email, parol, ism → tasdiqlash xati |
| POST | `/auth/login` | → `access`, `refresh`; admin bo'lsa `requires_2fa: true` |
| POST | `/auth/2fa/verify` | TOTP kod → tokenlar |
| POST | `/auth/2fa/setup` | QR uchun secret (admin) |
| POST | `/auth/google` | Google `id_token` → tokenlar (yangi bo'lsa yaratiladi) |
| POST | `/auth/refresh` | refresh rotation |
| POST | `/auth/logout` | joriy refresh token bekor |
| POST | `/auth/logout-all` | barcha qurilmalardan chiqish |
| POST | `/auth/verify-email` | token |
| POST | `/auth/resend-verification` | |
| POST | `/auth/forgot-password` | email → xat (email mavjudligini oshkor qilmaydi) |
| POST | `/auth/reset-password` | token + yangi parol |
| POST | `/auth/change-password` | eski + yangi |

## Men (profil) 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/me` | user + profile + bugungi qisqa holat |
| PATCH | `/me/profile` | profil maydonlari |
| POST | `/me/avatar` | rasm yuklash (multipart) → kesilgan, siqilgan URL |
| PATCH | `/me/settings` | til, mavzu, bildirishnomalar, namoz sozlamalari |
| POST | `/me/onboarding` | onboarding javoblari → AI rejasini ishga tushiradi |
| POST | `/me/devices` | push token ro'yxatga olish |
| DELETE | `/me/devices/{id}` | |
| POST | `/me/export` | ma'lumotlar eksporti (fon vazifa → email'ga havola) |
| DELETE | `/me` | o'chirish so'rovi (30 kun ichida bekor qilish mumkin) |
| POST | `/me/restore` | o'chirishni bekor qilish |

## Kun tartibi 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/templates?category=` | katalog |
| GET | `/modes` · POST `/modes` · PATCH/DELETE `/modes/{id}` | rejimlar |
| GET | `/routine-items?mode_id=` | |
| POST | `/routine-items` | yaratish (yoki `template_id` bilan) |
| PATCH | `/routine-items/{id}` | |
| DELETE | `/routine-items/{id}` | arxivlash |
| POST | `/routine-items/reorder` | `[id, …]` |
| POST | `/routine-items/bulk` | AI rejasini bir yo'la qo'shish |

## Bugun va check-in 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/today?date=` | shu kunning vazifalari (rejim + namoz vaqtlari hisoblangan) + check-in holatlari |
| PUT | `/checkins` | upsert: `routine_item_id, date, status, value, excuse_reason, client_id` |
| DELETE | `/checkins/{id}` | bekor qilish |
| POST | `/checkins/batch` | offline navbatini yuborish |
| GET | `/sync?since=` | o'zgarishlar (delta) — mobil offline uchun 🟡 |
| PUT | `/days/{date}/reflection` | kayfiyat, energiya, refleksiya 🟡 |

> Bildirishnomadagi "Bajardim" tugmasi ilovani ochmasdan `PUT /checkins` ga so'rov yuboradi (fon vazifa orqali); internet bo'lmasa navbatga qo'yiladi.

## Statistika 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/stats/weekly?week=2026-W42` | halqalar, umumiy ball, kunlar, o'tgan hafta bilan farq |
| GET | `/stats/monthly?month=2026-10` | |
| GET | `/stats/category/{category}?from=&to=` | kalendar + grafik + eng yaxshi/zaif kun |
| GET | `/stats/item/{routine_item_id}?from=&to=` | bitta vazifa |
| GET | `/stats/streaks` | |
| POST | `/streaks/freeze` | muzlatishdan foydalanish |
| GET | `/stats/heatmap?year=` | 🟡 |
| GET | `/insights` | 🟡 |
| GET | `/share/weekly-card?week=&format=story` | PNG ulashish kartasi 🟡 |

## Namoz 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/prayer/times?date=&days=7` | profildagi joylashuv va sozlamalar bo'yicha |
| GET | `/prayer/qaza` · PATCH `/prayer/qaza` | qazo hisobi |
| GET | `/prayer/ramadan?year=` | saharlik/iftorlik 🟡 |

> Ilova vaqtlarni o'zi ham hisoblaydi (offline). Server faqat bir xillik va web uchun.

## Fokus 🟢

POST `/pomodoro/sessions` · PATCH `/pomodoro/sessions/{id}` · GET `/pomodoro/stats?from=&to=`

## Kitob, Qur'on, zikr, uyqu 🟡

- `/books` CRUD · POST `/books/{id}/logs`
- GET/PATCH `/quran/progress` · POST `/quran/logs`
- `/dhikr` CRUD · POST `/dhikr/{id}/logs` (`date, count` — ilova to'plab yuboradi)
- GET/POST `/sleep-logs`

## Maqsadlar 🟡

`/goals` CRUD. `is_main: true` bo'lgani `profiles.main_goal` bilan sinxron.

## Challenge 🟡

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/challenges?scope=public|mine` | |
| POST | `/challenges` | shaxsiy challenge |
| GET | `/challenges/{id}` | |
| POST | `/challenges/{id}/join` | |
| PUT | `/challenges/{id}/logs` | `date, value` (kuniga bitta, tahrirlanadi) |
| GET | `/challenges/{id}/leaderboard` | |

## Nishonlar 🟡

GET `/badges` (hammasi + qaysilari olingan) · GET `/me/xp`

## AI 🟢 (tafsilot — [04-ai.md](04-ai.md))

| Metod | Yo'l | Vazifasi |
|---|---|---|
| POST | `/ai/chat` | `conversation_id?, message` → **SSE stream** |
| GET | `/ai/conversations` · GET `/ai/conversations/{id}` · DELETE | |
| GET | `/ai/usage` | `{used: 3, limit: 15, resets_at}` |
| POST | `/ai/plan` | onboarding yoki "Ertangi kunni rejalashtir" → tuzilgan JSON reja |
| POST | `/ai/reports/weekly` | **haftada 1 marta**; mavjud bo'lsa o'shani qaytaradi |
| GET | `/ai/reports?kind=` · GET `/ai/reports/{id}` | |

## Kontent 🟢

| Metod | Yo'l | Vazifasi |
|---|---|---|
| GET | `/motivations/today` | kun motivatsiyasi |
| GET | `/motivations?category=&cursor=` | lenta |
| GET | `/banners?placement=home_top` | foydalanuvchi auditoriyasiga mos, faol bannerlar |
| POST | `/banners/{id}/events` | `impression` / `click` (to'plab yuborish mumkin) |
| GET | `/notifications` · POST `/notifications/{id}/read` · POST `/notifications/read-all` | |

## Ijtimoiy 🔵

- `/groups` (GET katalog, POST yaratish) · GET/PATCH `/groups/{slug}` · POST `/groups/{slug}/join` · `/leave`
- GET `/groups/{slug}/members` · GET `/groups/{slug}/leaderboard?week=`
- GET `/users/{username}` (ochiq profil) · GET `/users/{username}/routine` · POST `/users/{username}/routine/copy`
- `/friends` · POST `/friends/requests` · POST `/friends/requests/{id}/accept|decline` · DELETE `/friends/{id}`
- `/partners` · POST `/partners/invite`
- GET `/leaderboard?scope=global&week=`
- POST `/reports` (shikoyat)

## Premium 🔵

GET `/plans` · POST `/subscriptions/checkout` (`provider: payme|click`) · GET `/subscriptions/me`
Webhook'lar: POST `/webhooks/payme` · `/webhooks/click` · `/webhooks/revenuecat`

---

## Admin 🔒 (`/api/v1/admin`, rol: `admin`/`super_admin`, 2FA bilan)

| Yo'l | Vazifasi |
|---|---|
| GET `/dashboard?from=&to=` | DAU/MAU, retention, ro'yxatlar, bajarish %, AI sarfi |
| GET `/users?q=&role=&status=` · GET `/users/{id}` · PATCH `/users/{id}` | rol, bloklash |
| `/motivations` CRUD | |
| `/banners` CRUD · GET `/banners/{id}/stats` | |
| POST `/uploads` | rasm yuklash (banner, motivatsiya) |
| `/push-campaigns` CRUD · POST `/push-campaigns/{id}/send` · POST `/push-campaigns/preview-segment` (nechta odamga boradi) | |
| `/templates` CRUD | |
| `/challenges` CRUD (umumiy) | |
| GET `/ai/providers` · PATCH `/ai/providers/{id}` · POST `/ai/providers/{id}/test` · GET `/ai/usage` | |
| `/badges` CRUD | |
| GET/PATCH `/settings` | `app_settings` |
| POST `/prayer/official-times` (CSV) | |
| GET `/audit-logs` | |
| `/groups`, `/reports` moderatsiya 🔵 | |

Har bir admin yozuvi `audit_logs` ga tushadi. `super_admin` ni faqat `super_admin` o'zgartira oladi. Birinchi `super_admin` (`ceonabiyev@gmail.com`) migratsiya/seed skripti orqali, `.env` dagi `SUPERADMIN_EMAIL` dan yaratiladi.

---

## Fon vazifalari (ARQ + cron)

| Vazifa | Qachon | Nima qiladi |
|---|---|---|
| `evening_summary` | har daqiqa | `evening_summary_time` si hozir bo'lgan foydalanuvchilarga (o'z timezone'ida): "Bugun 7/9 bajarildi. Kitob qolib ketdi." |
| `close_day` | har soat | mahalliy yarim tun o'tgan foydalanuvchilar: belgilanmaganlarni `missed` (`source=auto`), `daily_summaries` va streak hisoblash |
| `never_miss_twice` | ertalab | kecha biror vazifa o'tib ketganlarga yumshoq eslatma |
| `streak_risk` | kechqurun | streak uzilish arafasidagilarga ogohlantirish |
| `goal_reminder` | kuniga 1 marta | chastotaga ko'ra "Don't forget why you started! — {oliy maqsad}" |
| `weekly_stats` | dushanba 00:30 (mahalliy) | haftalik yig'indi, leaderboard snapshot, "AI hisobotingiz tayyorlash mumkin" xabari |
| `badges_award` | `close_day` dan keyin | nishon qoidalarini tekshirish |
| `insights_compute` 🟡 | haftada 1 | bog'liqliklarni hisoblash |
| `push_campaign_send` | rejalashtirilgan vaqtda | segment bo'yicha, 500 talik bo'laklarda |
| `banner_stats_rollup` | har soat | `banner_events` → `banner_stats_daily` |
| `ai_provider_health` | 5 daqiqada | cooldown tugaganlarni sinash |
| `hard_delete_accounts` | kuniga 1 | 30 kundan oshgan o'chirish so'rovlari |
| `cleanup_tokens` | kuniga 1 | eskirgan tokenlar |

> **Eslatma:** uyg'otish va kun tartibi eslatmalari **serverdan emas, qurilmaning o'zida** rejalashtiriladi. Ilova har ochilganda va kun tartibi o'zgarganda keyingi 7 kunlik eslatmalarni qayta rejalashtiradi (iOS'da bir vaqtda 64 tagacha lokal eslatma — shuning uchun 7 kun).

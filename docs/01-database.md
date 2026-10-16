# 01 — Ma'lumotlar bazasi sxemasi

PostgreSQL 16. Barcha `id` — `uuid` (v7, vaqt bo'yicha tartiblanadi). Barcha jadvallarda `created_at`, `updated_at` (timestamptz) bor — quyida takrorlanmaydi. Ko'p tilli matnlar `jsonb` ko'rinishida: `{"uz": "...", "ru": "...", "en": "..."}`.

**Muhim qoida:** sana (`date`) har doim foydalanuvchining **mahalliy sanasi** (uning `timezone`iga ko'ra). Vaqt (`timestamptz`) — UTC.

Belgilar: 🟢 v1 · 🟡 v1.5 · 🔵 v2

---

## 1. Foydalanuvchilar va auth 🟢

### `users`
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| email | citext UNIQUE | |
| password_hash | text NULL | Google orqali kirganlarda NULL; argon2id |
| google_sub | text UNIQUE NULL | Google akkaunt ID |
| email_verified_at | timestamptz NULL | |
| role | enum `user, moderator, admin, super_admin` | default `user` |
| status | enum `active, blocked, pending_deletion` | |
| last_seen_at | timestamptz | |
| deletion_requested_at | timestamptz NULL | 30 kundan keyin butunlay o'chiriladi |

### `profiles` (1:1 users)
| Ustun | Tur | Izoh |
|---|---|---|
| user_id | uuid PK FK | |
| full_name | text | |
| username | citext UNIQUE NULL | ochiq profil uchun (v2) |
| avatar_url | text NULL | |
| user_type | enum `university_student, school_pupil, worker, freelancer, entrepreneur, other` | "Siz kimsiz?" |
| user_type_other | text NULL | "Boshqa" tanlansa |
| birth_year | smallint | yosh o'rniga — har yil yangilash shart emas |
| gender | enum `male, female, unspecified` | "uzrli" holat (hayz) faqat ayollarga taklif qilinadi |
| language | enum `uz, ru, en` | default `uz` |
| theme | enum `system, light, dark` | |
| timezone | text | masalan `Asia/Tashkent` |
| city | text | |
| latitude, longitude | numeric(9,6) | namoz vaqtlari uchun |
| prays | boolean | namoz o'qiydimi |
| prayer_method | text | hisoblash usuli (default — O'zbekistonga mos) |
| madhab | enum `hanafi, shafi` | asr vaqti uchun; default `hanafi` |
| prayer_offsets | jsonb | `{"fajr": -2, "dhuhr": 3, ...}` daqiqa tuzatish |
| wake_time, sleep_time | time | |
| evening_summary_time | time | kechki xulosa xabari vaqti |
| main_goal | text | **"Eng oliy maqsadingiz?"** |
| goal_reminder_freq | enum `daily, every_3_days, weekly` | maqsadni eslatish |
| interests | text[] | `sport, reading, language, quran, study, ...` |
| privacy | enum `public, friends, private` | default `private` (v2 da muhim) |
| xp | int | gamifikatsiya 🟡 |
| level | smallint | 🟡 |
| onboarding_completed_at | timestamptz NULL | |

### `refresh_tokens`
id, user_id FK, token_hash, device_id FK NULL, expires_at, revoked_at NULL, replaced_by uuid NULL (rotation zanjiri).

### `email_tokens`
id, user_id FK, purpose enum `verify_email, reset_password, change_email`, token_hash, expires_at, used_at NULL.

### `user_2fa` (admin uchun majburiy)
user_id PK, totp_secret_encrypted, enabled_at, backup_codes_hash text[].

### `devices`
id, user_id FK, platform enum `ios, android, web`, push_token, app_version, locale, last_active_at. Bir foydalanuvchida bir nechta qurilma.

---

## 2. Kun tartibi 🟢

### `task_templates` — admin boshqaradigan katalog
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| category | enum `prayer, reading, sport, study, language, quran, dhikr, sleep, health, work, custom` | |
| title | jsonb | 3 tilda |
| description | jsonb | |
| icon, color | text | |
| default_time | time NULL | |
| default_duration_min | smallint | |
| default_target | numeric NULL | masalan 20 (bet) |
| unit | text NULL | `bet, daqiqa, so'z, marta, km` |
| min_version | jsonb NULL | "kamida 2 bet" |
| suitable_for | text[] | `university_student, school_pupil, ...` — AI va onboarding uchun |
| is_active | boolean | |
| sort_order | int | |

### `schedule_modes` — rejimlar
id, user_id FK, name, type enum `weekday, weekend, exam, vacation, ramadan, custom`, days_of_week smallint (bitmask, Du=1 … Ya=64), starts_on date NULL, ends_on date NULL, is_active boolean.
> Masalan "Ish kuni" (Du–Ju), "Dam olish" (Sh–Ya), "Ramazon" (sana oralig'i bilan, avtomatik yoqiladi).

### `routine_items` — foydalanuvchi vazifalari
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| mode_id | uuid FK NULL | NULL = barcha rejimlarda |
| template_id | uuid FK NULL | katalogdan qo'shilgan bo'lsa |
| goal_id | uuid FK NULL | qaysi maqsadga xizmat qiladi 🟡 |
| title | text | |
| category | enum (yuqoridagi) | |
| icon, color | text | |
| start_time | time NULL | |
| duration_min | smallint NULL | |
| days_of_week | smallint | bitmask |
| prayer_name | enum `fajr, dhuhr, asr, maghrib, isha` NULL | namoz bo'lsa |
| time_from_prayer | boolean | vaqt namozdan avtomatik olinadi |
| prayer_offset_min | smallint | masalan bomdoddan +10 daq |
| target_value | numeric NULL | |
| unit | text NULL | |
| min_version_text | text NULL | "kamida 2 bet" |
| reminder_enabled | boolean | |
| reminder_offset_min | smallint | boshlanishidan necha daqiqa oldin |
| alarm_type | enum `notification, alarm, strict_alarm` | 🟡 `strict_alarm` |
| strict_dismiss | enum `math, qr, steps` NULL | 🟡 |
| qr_secret | text NULL | 🟡 hammomdagi QR uchun |
| sort_order | int | |
| is_active | boolean | |
| archived_at | timestamptz NULL | o'chirilsa ham statistika saqlanadi |

Indeks: `(user_id, is_active)`.

### `checkins` — har bir vazifaning kunlik natijasi
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| routine_item_id | uuid FK | |
| date | date | mahalliy sana |
| status | enum `done, partial, missed, excused` | |
| excuse_reason | enum `sick, travel, menstruation, other` NULL | `excused` bo'lsa |
| value | numeric NULL | o'qilgan bet, yodlangan so'z… |
| note | text NULL | |
| checked_at | timestamptz | |
| source | enum `app, notification, widget, web, auto` | `auto` = kun oxirida avtomatik `missed` |
| client_id | uuid | offline sinxron uchun (idempotentlik) |

UNIQUE `(routine_item_id, date)`. Indeks `(user_id, date)`.

> **Statistika qoidasi:** `excused` bajarilgan ham, o'tkazilgan ham hisoblanmaydi — maxrajdan chiqariladi. `partial` = 0.5 ball.

### `daily_summaries` — kunlik yig'indi (server hisoblaydi)
user_id, date (PK birgalikda), planned, done, partial, missed, excused, score numeric(5,2) (0–100), by_category jsonb, mood smallint NULL 🟡, energy smallint NULL 🟡, reflection text NULL 🟡, computed_at.

### `streaks`
id, user_id, scope enum `overall, item, category`, scope_ref text NULL, current int, longest int, last_counted_date date.

### `streak_freezes`
id, user_id, date, used_at. Oyiga 2 ta (Premium'da 4 ta) — `app_settings` dan o'qiladi.

---

## 3. Namoz 🟢

Namoz check-in'lari `routine_items` (`prayer_name` bilan) va `checkins` orqali yuradi — alohida jadval kerak emas.

### `qaza_prayers`
user_id, prayer_name (PK birgalikda), owed int, made int, updated_at.

### `official_prayer_times` (ixtiyoriy)
region text, date date, fajr…isha time. Admin O'zbekiston Musulmonlar idorasi taqvimini yuklasa — hisoblangan vaqt o'rniga shu ishlatiladi.

---

## 4. Fokus (Pomodoro) 🟢

### `pomodoro_sessions`
id, user_id, routine_item_id NULL, kind enum `focus, short_break, long_break`, planned_min, actual_min, started_at, ended_at, completed boolean, interruptions smallint, client_id.

---

## 5. Kitob, Qur'on, zikr, uyqu 🟡

### `books`
id, user_id, title, author, total_pages, current_page, status enum `reading, finished, paused, planned`, cover_url, started_on, finished_on.

### `reading_logs`
id, user_id, book_id, date, pages, minutes, checkin_id NULL (kun tartibidagi "kitob o'qish" bilan bog'lanadi).

### `quran_progress`
user_id PK, current_page smallint (1–604), khatm_count, daily_target_pages.

### `quran_logs`
id, user_id, date, from_page, to_page.

### `dhikr_counters`
id, user_id, name ("Subhanalloh"…), target int, is_active.

### `dhikr_logs`
counter_id, date (PK birgalikda), count. Ilova sanaydi, serverga to'plab yuboradi.

### `sleep_logs`
id, user_id, date, slept_at timestamptz, woke_at timestamptz, quality smallint NULL, source enum `manual, alarm, health`.

---

## 6. Maqsadlar 🟡

### `goals`
id, user_id, parent_id FK NULL, title, description, is_main boolean (oliy maqsad, `profiles.main_goal` bilan sinxron), target_date NULL, status enum `active, achieved, dropped`, achieved_at.

---

## 7. Til challenge 🟡

### `challenges`
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| creator_id | uuid FK NULL | NULL = admin e'lon qilgan umumiy challenge |
| kind | enum `language_words, reading_pages, custom` | |
| title, description | jsonb | |
| language_code | text NULL | `en, ru, de, ar, ko…` |
| target_value | int | 300 |
| unit | text | `so'z` |
| duration_days | smallint | 10 |
| starts_on, ends_on | date NULL | umumiy challenge uchun |
| visibility | enum `private, public` | |
| status | enum `draft, active, finished` | |

### `challenge_participants`
id, challenge_id, user_id, joined_at, personal_start date, progress_total int, completed_at NULL, show_on_profile boolean. UNIQUE `(challenge_id, user_id)`.

### `challenge_logs`
id, participant_id, date, value int, note. UNIQUE `(participant_id, date)` — kuniga bitta yozuv, tahrirlanadi.

### `flashcard_decks`, `flashcards` (keyinroq)
Takrorlash tizimi (SM-2): word, translation, example, ease, interval_days, due_on.

---

## 8. Gamifikatsiya 🟡

### `badges`
id, code UNIQUE (`streak_7`, `fajr_30`, `book_10`…), title jsonb, description jsonb, icon, rule jsonb, xp_reward.

### `user_badges`
user_id, badge_id (PK birgalikda), earned_at.

### `xp_events`
id, user_id, reason, amount, ref_id, created_at.

---

## 9. AI 🟢

### `ai_providers`
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE | `gemini, groq, openrouter, deepseek, grok` |
| model | text | |
| priority | smallint | kichik raqam = birinchi |
| enabled | boolean | |
| daily_request_cap | int NULL | o'zimiz qo'ygan xavfsiz chegara |
| api_key_env | text | kalit emas, **env o'zgaruvchi nomi** |
| is_paid | boolean | |

> Provayderning "dam olish" holati (cooldown) va kunlik hisob Redis'da: `ai:cooldown:{code}`, `ai:count:{code}:{date}`.

### `ai_conversations`
id, user_id, title, last_message_at.

### `ai_messages`
id, conversation_id, role enum `user, assistant, system`, content, provider_code NULL, model NULL, tokens_in, tokens_out, latency_ms, fallback_level smallint (0 = birinchi provayder javob berdi).

### `ai_reports`
id, user_id, kind enum `weekly, monthly, onboarding_plan`, period_start, period_end, stats_snapshot jsonb, content text, provider_code. UNIQUE `(user_id, kind, period_start)` — **haftasiga bitta**.

### `ai_usage_daily`
user_id, date (PK birgalikda), messages int. (Asosiy hisob Redis'da, bu — tarix va analitika uchun.)

### `insights` 🟡
id, user_id, kind (`sleep_vs_score`, `best_time`, `weak_day`…), text jsonb, data jsonb, valid_until.

---

## 10. Kontent va admin 🟢

### `motivations`
id, text jsonb (3 tilda), author NULL, category enum `discipline, time, faith, study, sport, general`, image_url NULL, is_active, publish_on date NULL ("kun motivatsiyasi"), created_by FK.

### `banners`
| Ustun | Tur | Izoh |
|---|---|---|
| id | uuid PK | |
| kind | enum `ad, news, announcement, motivation` | |
| title, subtitle | jsonb | |
| image_mobile_url, image_desktop_url | text | |
| link_url | text NULL | ichki (`dailer://challenges/…`) yoki tashqi |
| placement | enum `home_top, motivations, profile, stats` | |
| audience | jsonb | `{"languages":["uz"],"user_types":["school_pupil"],"platforms":["android"]}` |
| starts_at, ends_at | timestamptz | |
| priority | smallint | |
| is_active | boolean | |
| created_by | uuid FK | |

### `banner_events`
id, banner_id, user_id NULL, event enum `impression, click`, platform, created_at. Kunlik yig'indi — `banner_stats_daily` (banner_id, date, impressions, clicks).

### `push_campaigns`
id, title jsonb, body jsonb, deep_link, segment jsonb (`{"inactive_days_gte":3,"user_types":[...]}`), scheduled_at, status enum `draft, scheduled, sending, sent, cancelled`, sent_count, opened_count, created_by.

### `notifications` — ilova ichidagi xabarlar qutisi
id, user_id, kind enum `evening_summary, goal_reminder, streak_risk, badge, campaign, system, social`, title, body, data jsonb, read_at NULL.

### `audit_logs`
id, actor_id, action (`banner.update`, `user.block`…), entity, entity_id, diff jsonb, ip, user_agent, created_at.

### `app_settings`
key PK, value jsonb. Masalan: `ai.daily_limit_free = 15`, `streak.freezes_per_month = 2`.

---

## 11. Ijtimoiy 🔵 (sxema hozir, funksiya v2 da)

### `groups`
id, name, slug UNIQUE, description, avatar_url, category enum `programmers, mathematicians, students, language_learners, athletes, other`, owner_id, visibility enum `public, private, invite_only`, member_count, is_verified (admin tasdiqlagan rasmiy guruh).

### `group_members`
group_id, user_id (PK birgalikda), role enum `owner, admin, member`, joined_at, share_stats boolean.

### `friendships`
id, requester_id, addressee_id, status enum `pending, accepted, declined, blocked`, responded_at. UNIQUE `(least(a,b), greatest(a,b))`.

### `accountability_pairs`
id, user_a, user_b, status enum `pending, active, ended`, notify_on_miss boolean.

### `shared_routines` — boshqalar nusxa oladigan ochiq kun tartibi
id, user_id, title, description, snapshot jsonb (vazifalar ro'yxati), copies_count, is_public.

### `leaderboard_snapshots`
scope enum `global, group`, scope_id NULL, period_start date, user_id, score, rank. Har dushanba hisoblanadi.

### `reports` — shikoyatlar
id, reporter_id, target_type (`user, group, message`), target_id, reason, status, handled_by.

---

## 12. Premium va B2B 🔵

### `subscriptions`
id, user_id, plan enum `free, premium_month, premium_year`, provider enum `payme, click, app_store, google_play`, status enum `active, grace, expired, cancelled`, started_at, expires_at, external_id.

### `payments`
id, user_id, subscription_id, provider, amount, currency (`UZS`), status, external_id, raw jsonb.

### `organizations`
id, name, kind enum `school, university, learning_center, company`, owner_id, plan, seats.

### `org_members`
org_id, user_id, role enum `owner, teacher, student`, class_name NULL, consent_at (o'quvchi roziligi — usiz ustoz ma'lumotni ko'rmaydi).

---

## Bog'lanishlar (qisqacha)

```
users 1─1 profiles
users 1─* devices, refresh_tokens, routine_items, checkins, goals, books ...
schedule_modes 1─* routine_items 1─* checkins
task_templates 1─* routine_items
goals 1─* routine_items
challenges 1─* challenge_participants 1─* challenge_logs
ai_conversations 1─* ai_messages
groups *─* users (group_members)
users *─* users (friendships, accountability_pairs)
```

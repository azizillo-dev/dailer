# Dailer — loyiha rejasi

> **"Don't forget why you started!"**
> Maqsadga yetish uchun 24/7 ishlash shart emas — tartib va intizom kerak.

Dailer — odamlarga kun tartibini tuzish, unga amal qilish va o'sish/pasayishini kuzatishga yordam beradigan platforma (web + mobil ilova). Asosiy til — **o'zbek** (lotin), qo'shimcha: rus, ingliz.

## Hujjatlar

| Fayl | Mazmuni |
|---|---|
| [01-database.md](01-database.md) | Ma'lumotlar bazasi sxemasi (barcha jadvallar) |
| [02-screens.md](02-screens.md) | Barcha ekranlar: web, mobil, admin |
| [03-api.md](03-api.md) | FastAPI endpointlari va fon vazifalari |
| [04-ai.md](04-ai.md) | AI yordamchi: provayderlar zanjiri, limitlar, promptlar |

## Texnologiyalar

| Qism | Tanlov |
|---|---|
| Backend | FastAPI (Python 3.12), SQLAlchemy 2 + Alembic, Pydantic v2 |
| Baza | PostgreSQL 16, Redis (kesh, limitlar, navbat) |
| Fon vazifalari | ARQ (async, Redis asosida) + cron |
| Web | Next.js (App Router) + TypeScript + Tailwind + Motion |
| Mobil | React Native (Expo) + TypeScript |
| Umumiy kod | `packages/shared` — API klient, tiplar, tarjimalar (i18n), statistikani hisoblash |
| Auth | Email+parol, Google OAuth, JWT access (15 daq) + refresh (30 kun, rotation) |
| Push | Expo Push (FCM/APNs) + Web Push (service worker) |
| Lokal eslatmalar | `expo-notifications` (qurilmada rejalashtiriladi) |
| Namoz vaqtlari | `adhan` kutubxonasi (qurilmada va serverda), har namozga ±daqiqa tuzatish |
| Fayllar | S3-mos saqlash (Cloudflare R2 / MinIO) — avatar, banner rasmlari |
| Email | Resend yoki SMTP |
| Monitoring | Sentry (xatolar), PostHog (analitika, feature flag) |
| To'lov (Premium) | Payme, Click (O'zbekiston), App Store / Google Play (RevenueCat orqali) |

### Repo tuzilishi

```
dailer/
  backend/            FastAPI
  apps/web/           Next.js — landing, foydalanuvchi paneli, /admin
  apps/mobile/        Expo — foydalanuvchi ilovasi + admin bo'limi
  packages/shared/    tiplar, API klient, i18n (uz/ru/en)
  docs/               shu hujjatlar
```

## Dizayn tamoyillari

- **Ranglar:** espresso `#2B1D14` · kofe `#4A3426` · karamel `#C08552` · latte `#E8D5BC` · krem `#F7F0E6`. Tungi rejim — espresso fon, krem matn.
- **Uslub:** kraft qog'oz teksturasi, qo'lda yozilgan kundalik hissi. Sarlavha — serif (Fraunces), matn — Manrope (ikkalasida kirill bor).
- **Animatsiya:** faqat `transform`/`opacity`, 60 fps, `prefers-reduced-motion` hurmat qilinadi.
- **Splash:** "Don't forget why you started!" harfma-harf yoziladi (≤2 s), ostida foydalanuvchining oliy maqsadi; bosilsa o'tib ketadi; faqat ilova/sayt ochilganda.
- **Mobil birinchi:** web ham 320px dan 4K gacha moslashadi.

## Bosqichlar (roadmap)

Barcha funksiyalar qo'shiladi; tartib — qaysi biri birinchi chiqishi.

### v1 — MVP
- Auth: email, Google, parolni tiklash, email tasdiqlash
- Onboarding (kimsiz, yosh, uyg'onish/uxlash, namoz, shahar, qiziqishlar, **eng oliy maqsad**)
- Splash va profil tepasida "Don't forget why you started!"
- Kun tartibi: vazifa qo'shish, shablonlar katalogi, rejimlar (ish kuni / dam olish)
- Check-in: bajardim / qisman / o'tkazdim / **uzrli**; bildirishnomadan to'g'ridan-to'g'ri "Bajardim"
- Lokal eslatmalar va kechki xulosa xabari
- Namoz vaqtlari avtomatik, namoz check-in, qazo hisobi
- Pomodoro taymer
- Haftalik hisobot (halqalar) + batafsil statistika + o'tgan hafta bilan solishtirish
- Streak + oyiga 2 ta "muzlatish", "ikki marta o'tkazma" eslatmasi
- **AI yordamchi** (qisqa javoblar, "qanday ketyapman?" tahlili, haftalik AI hisobot — haftada 1 marta)
- Motivatsiyalar bo'limi, aylanuvchi bannerlar
- Admin panel (web + mobil): motivatsiya, banner, push, foydalanuvchilar, AI provayderlar
- Profil: 3 til, rasm, tahrirlash; akkauntni o'chirish, ma'lumot eksporti

### v1.5
- Til challenge ("10 kunda 300 so'z") + admin e'lon qiladigan umumiy challenge'lar
- Ramazon rejimi (saharlik/iftorlik avtomatik)
- Kitoblar trackeri, Qur'on trackeri, zikr/tasbeh hisoblagich
- Uyqu trackeri, kechki refleksiya (kayfiyat/energiya 1–5)
- Heatmap (yillik), bog'liqlik insight'lari ("23:00 dan oldin uxlagan kunlaringiz…")
- AI oylik tahlil
- Hisobotni rasm qilib story'ga ulashish
- Widgetlar (Android/iOS bosh ekrani)
- Qat'iy budilnik (misol / QR bilan o'chadi)
- Maqsadlar ierarxiyasi (oliy maqsad → kichik maqsadlar → odatlar)
- Nishonlar (badges) va darajalar
- Google Calendar sinxroni, offline rejim + sinxronlash

### v2
- Guruhlar (dasturchilar, matematiklar, …), guruh ichidagi reyting
- Do'stlashish, ochiq profil, boshqalarning kun tartibini ko'rish va nusxa olish
- Accountability sherik
- Fokus rejimi (chalg'ituvchi ilovalarni bloklash)
- Premium obuna
- B2B: maktab/universitet/o'quv markazi paneli

## Qabul qilingan qarorlar

- Asosiy til — o'zbek (lotin).
- AI — doim mavjud, qisqa javob beradi; tekin yoki juda arzon provayderlar zanjiri, limit tugasa avtomatik almashadi ([04-ai.md](04-ai.md)).
- Admin — `ceonabiyev@gmail.com`, bazada `super_admin` roli sifatida (kodga yozilmaydi), 2FA majburiy.
- Guruhlar va do'stlar — v2, lekin baza sxemasi hozirdanoq tayyor.

# Deploy (bepul)

Hozirgi production:

| Qism | Manzil | Xizmat |
|---|---|---|
| Sayt | https://dailer-seven.vercel.app | Vercel (loyiha `dailer`, root `apps/web`) |
| API | https://dailer-api.vercel.app | Vercel serverless FastAPI (loyiha `dailer-api`, root `backend`, fra1) |
| Postgres | Neon (Vercel Marketplace, Free, fra1) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` avtomatik |
| Fon vazifalari | GitHub Actions `.github/workflows/cron.yml` | tick — 15 daqiqada, daily — Toshkent 03:00 |
| Redis | yo'q (`REDIS_URL=memory://`) | Upstash ulash uchun shartlarni brauzerda qabul qilish kerak |
| Email | hali sozlanmagan | Gmail SMTP yoki Brevo — pastda |

`main` ga har push — ikkala loyiha avtomatik qayta deploy bo'ladi.
Qo'lda qayta deploy: Vercel dashboard → loyiha → Deployments → Redeploy.

## Serverless'ga moslashuvlar

- `DB_NULL_POOL=true` — har so'rov o'z ulanishi; Neon pooler'siz manzili (prepared statement'lar uchun).
- `UPLOAD_STORAGE=db` — rasmlar Postgres'da (funksiya diski vaqtinchalik).
- Bildirishnoma dedupe — bazada (`notifications.dedupe_key` unique), Redis'da emas.
- Worker yo'q: GitHub Actions `POST /api/v1/internal/cron/{tick,daily}` ni chaqiradi.
  Kalit saqlanmaydi — API GitHub OIDC tokenini tekshiradi (`CRON_GITHUB_REPO=azizillo-dev/dailer`, faqat `main`).
  `CRON_WINDOW_MIN=15` — xabarlar vaqti kelgandan keyingi 15 daqiqa ichida yuboriladi.
- Neon Free — oyiga 100 CU-soat; 15 daqiqalik cron bilan baza oraliqda uxlaydi, limitga sig'adi.

## Migratsiyalar

Vercel'da migratsiya ishlamaydi — yangi migratsiyadan keyin lokal kompyuterdan:

```bash
cd backend
vercel env pull .env.local --environment production   # DATABASE_URL_UNPOOLED
DATABASE_URL_UNPOOLED=... python -m alembic upgrade head
```

Push'dan **oldin** migratsiyani qo'llang (yangi kod eski sxemada ishlamasligi mumkin).

## Env o'zgaruvchilarini o'zgartirish

```bash
cd backend && vercel env add NAME production    # qiymat so'raladi
```

Keyin qayta deploy kerak: `main` ga push yoki Vercel dashboard → Redeploy.

## Hali qilinadigan

1. **Google OAuth** — Google Cloud Console'da Web va Android Client ID:
   - Web: Authorized JavaScript origins — `https://dailer-seven.vercel.app`, `http://localhost:3000`
   - Android: package `uz.dailer.app`, SHA-1 (debug) `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - API: `GOOGLE_CLIENT_IDS=<web id>`; sayt: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web id>`;
     mobil: `app.json` → `extra.googleWebClientId`.
2. **Email** (Vercel SMTP portlarini to'smaydi):
   - Gmail: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_TLS=true`, `SMTP_USER=siz@gmail.com`,
     `SMTP_PASSWORD=<App password>`, `MAIL_FROM=Dailer <siz@gmail.com>`
   - yoki Brevo: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `MAIL_FROM`.
3. **Upstash Redis** (ixtiyoriy) — AI kunlik limiti va rate limit nusxalar orasida umumiy bo'lishi uchun:
   `vercel integration add upstash/upstash-kv --plan free -m primaryRegion=fra1` (avval shartlarni brauzerda qabul qilish).
4. AI kalitlari (`GEMINI_API_KEY`, `GROQ_API_KEY`, ...) — bo'lmasa shablon javob ishlaydi.

## Super admin

`SUPERADMIN_EMAIL` (ceonabiyev@gmail.com) bilan ro'yxatdan o'ting yoki Google bilan kiring —
email tasdiqlangan zahoti super admin roli avtomatik beriladi. Kirgach `/admin` da 2FA'ni sozlang.

## Mobil ilova

`apps/mobile/app.json` → `extra.apiUrl` = `https://dailer-api.vercel.app` (production build uchun).
Google bilan kirish va ekran vaqti — native modul: Expo Go'da emas, `npx expo run:android` yoki EAS build'da.

## Android APK (yangi versiya chiqarish)

APK GitHub Releases'da: https://github.com/azizillo-dev/dailer/releases/latest/download/dailer.apk
(sayt shu "latest" havolani ishlatadi — yangi release chiqqanda sayt o'zgarmaydi).

1. `apps/mobile/app.json` → `version` va `android.versionCode` ni oshiring.
2. Native loyiha va build (Android SDK `D:\devndroid-sdk`, JDK `D:\dev\jdk`):
   ```bash
   cd apps/mobile
   npx expo prebuild --platform android --clean --no-install
   # android/gradle.properties: reactNativeArchitectures=armeabi-v7a,arm64-v8a (APK kichik bo'ladi)
   cd android && ./gradlew assembleRelease     # → app/build/outputs/apk/release/app-release.apk
   ```
3. GitHub → Releases → yangi tag (`v1.0.1`), faylni `dailer.apk` nomi bilan yuklang.

Imzo — Expo shablonidagi debug kaliti (SHA-1 `5E:8F:16:...:F6:25`, Google Android client'da shu).
Play Market'ga chiqishda alohida release kaliti yaratiladi va uning SHA-1 si Google'ga qo'shiladi.

## Muqobil: Render

`render.yaml` — Render Free + Supabase uchun blueprint (Render'da SMTP yopiq — Brevo kerak).

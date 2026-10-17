# Bepul deploy

| Qism | Xizmat | Bepul tarif |
|---|---|---|
| Sayt (Next.js) | **Vercel** Hobby | shaxsiy/notijorat loyiha uchun |
| API (FastAPI) | **Render** Free, Frankfurt | 750 soat/oy, 15 daqiqa so'rov bo'lmasa uxlaydi, SMTP portlari yopiq |
| Postgres | **Supabase** Free, Frankfurt | 500 MB; 1 hafta faolsiz qolsa to'xtaydi (cron buni oldini oladi) |
| Email | **Brevo** Free | HTTPS API, kuniga ~300 ta xat |
| Fon vazifalari | **cron-job.org** | har daqiqada chaqiradi |
| Redis | — | kerak emas: `REDIS_URL` bo'sh → xotiradagi o'rinbosar |

Nima uchun shunday:
- Render bepul tarifda **SMTP (25/465/587) yopiq** → xatlar Brevo API orqali (`EMAIL_PROVIDER=brevo`).
- Render diski vaqtinchalik → rasmlar Postgres'da (`UPLOAD_STORAGE=db`).
- Alohida worker yo'q → cron-job.org `POST /api/v1/internal/cron/tick` ni har daqiqada chaqiradi.
  Bu API'ni ham uyg'oq tutadi (bitta servis 24/7 ≈ 720 soat < 750).
- Neon o'rniga Supabase: cron har daqiqada bazaga murojaat qiladi, Neon'ning oylik compute soatlari yetmaydi.

## 1. Supabase (Postgres)

1. supabase.com → New project, region **Frankfurt (eu-central-1)**, kuchli parol.
2. **Connect** → **Session pooler** (IPv4) manzilini nusxalang:
   `postgresql://postgres.<ref>:<parol>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`
   (Render IPv6'ga ulana olmaydi — "Direct connection" emas, aynan Session pooler.)

## 2. Brevo (email)

1. brevo.com → ro'yxatdan o'ting.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** — Gmail manzilingiz, kelgan xat orqali tasdiqlang.
3. **SMTP & API → API Keys → Generate** — kalitni nusxalang.

## 3. Render (API)

1. render.com → **New → Blueprint** → GitHub'dagi `dailer` repo. `render.yaml` o'qiladi.
2. So'raladigan qiymatlar:
   - `DATABASE_URL` — 1-qadamdagi manzil
   - `PUBLIC_URL` — `https://dailer-api.onrender.com` (Render bergan nom)
   - `WEB_URL`, `CORS_ORIGINS` — Vercel manzili (`https://dailer.vercel.app`)
   - `GOOGLE_CLIENT_IDS` — Google Web Client ID
   - `BREVO_API_KEY`, `MAIL_FROM` — `Dailer <siz@gmail.com>`
   - `VAPID_*`, AI kalitlari — ixtiyoriy
3. Deploy tugagach: `https://<nom>.onrender.com/health` → `{"status":"ok"}`.
   Migratsiyalar har ishga tushishda o'zi bajariladi (`alembic upgrade head`).
4. **Environment** bo'limidan `CRON_SECRET` qiymatini nusxalang (Render o'zi yaratgan).

## 4. cron-job.org

Ikkita vazifa (Advanced → Request method **POST**, Header `X-Cron-Secret: <CRON_SECRET>`):

| URL | Jadval |
|---|---|
| `https://<nom>.onrender.com/api/v1/internal/cron/tick` | har daqiqada |
| `https://<nom>.onrender.com/api/v1/internal/cron/daily` | har kuni 03:00 |

## 5. Vercel (sayt)

1. vercel.com → **Add New → Project** → `dailer` repo, **Root Directory: `apps/web`**.
2. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://<nom>.onrender.com`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = Google Web Client ID
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = (ixtiyoriy)
3. Deploy. Manzilni Render'dagi `WEB_URL` va `CORS_ORIGINS` ga yozing.

## 6. Google OAuth

Google Cloud Console → Credentials → Web client → **Authorized JavaScript origins** ga
Vercel manzilini qo'shing (`https://dailer.vercel.app`).

## 7. Super admin

Saytda `SUPERADMIN_EMAIL` (ceonabiyev@gmail.com) bilan ro'yxatdan o'ting (yoki Google bilan kiring) —
email tasdiqlangan zahoti super admin roli avtomatik beriladi. Kirgach `/admin` da 2FA'ni sozlang.

## Mobil ilova

`apps/mobile/app.json` → `extra.apiUrl` = Render manzili, `extra.googleWebClientId` = Web Client ID.
Google bilan kirish va ekran vaqti native modul — Expo Go'da emas, `npx expo run:android` yoki EAS build'da ishlaydi.

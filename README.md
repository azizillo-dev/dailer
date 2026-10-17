# Dailer

> **"Don't forget why you started!"**
> Maqsadga yetish uchun 24/7 ishlash shart emas — tartib va intizom kerak.

Kun tartibini tuzish, unga amal qilish va o'sishni kuzatish platformasi: web + mobil ilova.

- Reja va hujjatlar — [docs/](docs/README.md)
- Backend (FastAPI) — [backend/](backend/)
- Web (Next.js) — [apps/web/](apps/web/)

## Lokal ishga tushirish

Talablar: Docker, Python 3.12, Node 20+.

```bash
# 1. Postgres (5433), Redis (6379), Mailpit (http://localhost:8025)
docker compose up -d

# 2. Backend — http://localhost:8010/docs
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt   # Linux/macOS: .venv/bin/pip
cp .env.example .env                                 # JWT_SECRET va ENCRYPTION_KEY ni o'zgartiring
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --port 8010 --reload

# 3. Web — http://localhost:3000
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Lokal muhitda yuborilgan barcha xatlar (tasdiqlash, parolni tiklash) Mailpit'da ko'rinadi: http://localhost:8025

### Fon vazifalari (kechki xulosa, eslatmalar)

```bash
cd backend
.venv/Scripts/arq app.worker.WorkerSettings
```

Har daqiqada: kechki xulosa (foydalanuvchi belgilagan vaqtda), oliy maqsad eslatmasi, "ikki marta o'tkazmang".
Har kuni 03:00 UTC: 30 kundan oshgan o'chirish so'rovlari.

### Push bildirishnomalar (Web Push)

```bash
cd backend && .venv/Scripts/python -m scripts.gen_vapid
```

`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` → `backend/.env`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` → `apps/web/.env.local`.

### AI yordamchi

`backend/.env` ga `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY` (bittasi ham yetadi).
Kalit bo'lmasa — statistikaga asoslangan shablon javob ishlaydi. Tartib va modellar: `/admin/ai`.

### Demo ma'lumot

```bash
cd backend && .venv/Scripts/python -m scripts.seed_demo   # demo@dailer.uz / Demo12345, 3 haftalik tarix
```

### Super admin

`backend/.env` dagi `SUPERADMIN_EMAIL` bilan ro'yxatdan o'ting va emailni tasdiqlang. Rol avtomatik beriladi. Yoki:

```bash
cd backend
.venv/Scripts/python -m scripts.seed_superadmin --password "KuchliParol1"
```

Admin API faqat **2FA yoqilgandan keyin** ochiladi (`/api/v1/auth/2fa/setup` → `/2fa/confirm`).

### Testlar

```bash
cd backend && .venv/Scripts/python -m pytest -q
```

# 02 — Ekranlar ro'yxati

Belgilar: 🟢 v1 · 🟡 v1.5 · 🔵 v2 · 🌐 faqat web · 📱 faqat mobil · (belgisiz = ikkalasida)

---

## A. Ochiq qism (ro'yxatdan o'tmagan) 🌐

### A1. Splash 🟢
- Krem fonda "Don't forget why you started!" harfma-harf yoziladi (≤2 s).
- Kirgan foydalanuvchida ostida uning **oliy maqsadi** chiqadi.
- Bosilsa yoki 2.5 s o'tsa — o'tib ketadi. Sessiyada bir marta.

### A2. Landing page 🟢
1. **Hero:** "Vaqt kam emas. Tartib kam." + qisqa izoh + [Bepul boshlash] [Ilovani yuklab olish].
2. **"Bir kun" scroll-hikoya:** foydalanuvchi pastga tushgan sari soat 05:00 → 23:00 o'tadi. Fon tongdan tungacha rang o'zgartiradi, vazifalar birin-ketin ✓ bo'ladi (uyg'onish → bomdod → kitob → dars → sport → xufton → uyqu).
3. **Muammo:** "24/7 ishlash shart emas — tartib va davomiylik yetadi."
4. **Funksiyalar** (kartochkalar): kun tartibi, namoz vaqtlari, Pomodoro, AI maslahatchi, haftalik hisobot, til challenge.
5. **Statistika jonli namunasi:** halqalar to'lib boradi, "o'tgan haftadan +18%".
6. **AI namunasi:** "Men talabaman, darsim 8:00–12:20…" → tayyor kun tartibi chiqadi (animatsiya).
7. **Motivatsion iqtiboslar** (aylanuvchi).
8. **Ilova yuklab olish:** App Store / Google Play, QR kod.
9. **FAQ.**
10. **Footer:** maxfiylik siyosati, shartlar, aloqa, til tanlash (uz/ru/en).

### A3. Kirish 🟢
Email + parol, [Google bilan kirish], "Parolni unutdingizmi?", "Ro'yxatdan o'tish".

### A4. Ro'yxatdan o'tish 🟢
Ism, email, parol (kuchlilik ko'rsatkichi), [Google bilan], shartlarga rozilik.

### A5. Email tasdiqlash 🟢
"Emailingizga havola yubordik" + qayta yuborish (60 s taymer).

### A6. Parolni unutdim → Yangi parol 🟢
Email kiritish → xat → havola → yangi parol (2 marta).

### A7. Maxfiylik siyosati, Foydalanish shartlari 🟢

### A8. Narxlar (Premium) 🔵

### A9. Ochiq profil `/u/{username}` 🔵
Avatar, ism, oliy maqsad (agar ochiq bo'lsa), streak, nishonlar, challenge progressi, ochiq kun tartibi → [Nusxa olish].

### A10. Ochiq challenge sahifasi `/c/{id}` 🟡
Tavsif, ishtirokchilar soni, reyting → [Qo'shilish].

---

## B. Onboarding (ro'yxatdan keyin, bir marta) 🟢

Har bir qadam — bitta savol, katta tugmalar, yuqorida progress chiziq.

| # | Savol | Turi |
|---|---|---|
| B1 | Siz kimsiz? | Talaba / Maktab o'quvchisi / Ishchi / Frilanser / Tadbirkor / Boshqa (matn) |
| B2 | Necha yoshdasiz? | tug'ilgan yil (g'ildirakcha) |
| B3 | Odatda soat nechada uyg'onasiz va uxlaysiz? | 2 ta vaqt |
| B4 | Namoz o'qiysizmi? | Ha, 5 vaqt / Ba'zan / Yo'q, lekin boshlamoqchiman / Yo'q |
| B5 | Qayerda yashaysiz? | Geolokatsiya ruxsati yoki shahar tanlash |
| B6 | Kuningizda nimalar bor? | Darslar/ish vaqti (boshlanish–tugash), kurslar |
| B7 | Nimalarni rivojlantirmoqchisiz? | ko'p tanlov: kitob, sport, til, Qur'on, dasturlash, uyqu… |
| B8 | **Eng oliy maqsadingiz nima?** | katta matn maydoni + misollar |
| B9 | AI kun tartibingizni tuzmoqda… | animatsiya → tayyor reja → [Qabul qilish] / [Tahrirlash] |
| B10 | Bildirishnomalarga ruxsat | nima uchun kerakligi tushuntiriladi |

---

## C. Asosiy ilova

Pastki navigatsiya (mobil) / chap panel (web): **Bugun · Statistika · Fokus · AI · Profil**

### C1. Bugun (bosh ekran) 🟢
- Yuqorida: sana, salom, kichik "Don't forget why you started!" + oliy maqsad (bosilsa yopiladi).
- **Banner karuseli** (`home_top`) — avtomatik aylanadi, swipe.
- Kunlik progress halqasi (masalan 5/9) + streak 🔥.
- **Vaqt chizig'i (timeline):** har bir vazifa kartochkasi — vaqt, nom, ikonka, holat.
  - Swipe o'ngga = Bajardim, chapga = boshqa holatlar (qisman / o'tkazdim / uzrli).
  - Bosilsa — tafsilot: qiymat kiritish (bet, so'z), izoh.
  - Hozirgi vazifa ajratib ko'rsatiladi, o'tganlari xiralashadi.
- Navbatdagi namoz vaqti va qolgan vaqt.
- Kun motivatsiyasi (kichik kartochka).
- [+] tugma — tez vazifa qo'shish.

### C2. Kun tartibi muharriri 🟢
- Rejimlar tablari: Ish kuni / Dam olish / Ramazon…
- Vazifalar ro'yxati — sudrab tartiblash.
- [Shablondan qo'shish] [O'zim yarataman] [AI'dan so'rash].

### C3. Vazifa yaratish/tahrirlash 🟢
Nom, kategoriya, ikonka/rang, vaqt (yoki "namozdan keyin +N daqiqa"), davomiylik, hafta kunlari, maqsad qiymati + birlik, minimal versiya, eslatma (necha daqiqa oldin), budilnik turi 🟡, qaysi maqsadga bog'liq 🟡.

### C4. Shablonlar katalogi 🟢
Kategoriyalar bo'yicha: Namoz, Kitob, Sport, O'qish, Til, Qur'on, Uyqu, Salomatlik. Har birida [Qo'shish].

### C5. Rejimlar 🟢
Rejim yaratish, kunlarini belgilash, sana oralig'i (imtihon, ta'til, Ramazon).

### C6. Namoz 🟢
- Bugungi 5 vaqt, har birida check-in.
- Hisoblash usuli, mazhab, ±daqiqa tuzatish.
- Qazo hisobi: har namoz bo'yicha qarz / o'qildi.
- Ramazon rejimi: saharlik / iftorlik vaqtlari 🟡.

### C7. Fokus (Pomodoro) 🟢
- Katta aylana taymer, 25/5 (sozlanadi), qaysi vazifa uchun.
- Ekran yoqiq turishi, fon ovozlari (ixtiyoriy).
- Sessiyalar tarixi va bugungi fokus daqiqalari.
- 📱 Fokus rejimi — chalg'ituvchi ilovalarni bloklash 🔵.

### C8. Statistika (hisobot) 🟢
- Hafta tanlash (← →).
- **Halqalar:** Namoz, Kitob, Vazifalar, Sport, Til (har biri % da).
- Umumiy ball va o'tgan hafta bilan farq (▲ +12% / ▼ −5%).
- Halqa bosilsa → **C9**.
- Kunlar bo'yicha ustunli diagramma.
- Streaklar.
- [AI haftalik hisobot] tugmasi (haftada 1 marta) → **C13**.
- [Ulashish] → **C17** 🟡.

### C9. Kategoriya statistikasi 🟢
- Kalendar: har kun yashil / sariq / qizil / kulrang (uzrli).
- Hafta/oy grafigi, solishtirish.
- Eng yaxshi va eng zaif kun, o'rtacha vaqt.
- Masalan namoz: har bir vaqt bo'yicha alohida %.

### C10. Heatmap va insight'lar 🟡
Yillik GitHub uslubidagi kalendar + "Bilasizmi?" kartochkalari (masalan "23:00 dan oldin uxlagan kunlaringiz 40% samaraliroq").

### C11. Kechki refleksiya (modal) 🟡
Kechki xulosa xabaridan ochiladi: bugungi natija + kayfiyat 1–5 + energiya 1–5 + bitta jumla.

### C12. AI yordamchi 🟢
- Chat oynasi, javoblar qisqa, oqim (streaming) bilan.
- Tez savollar: "Qanday ketyapman?", "Ertangi kunni rejalashtir", "Nega kitob o'qishni o'tkazib yuboryapman?", "Motivatsiya ber".
- Pastda: bugun qolgan savollar soni (masalan 12/15).
- AI taklif qilgan rejani bir bosishda kun tartibiga qo'shish.

### C13. AI hisobotlar 🟢
Haftalik (🟢) va oylik (🟡) hisobotlar ro'yxati va o'qish sahifasi.

### C14. Kitoblar 🟡
Hozir o'qilayotgan, tugatilgan, rejadagi kitoblar. Sahifa progressi, yillik maqsad.

### C15. Qur'on va zikr 🟡
Sahifa/pora progressi, xatm soni. Tasbeh — katta tugma, tebranish, maqsad.

### C16. Uyqu 🟡
Yotish/turish vaqtlari, haftalik o'rtacha, budilnik bilan bog'liq.

### C17. Ulashish kartasi 🟡
Haftalik natijadan chiroyli rasm (story 9:16 / kvadrat) yasaladi → Instagram, Telegram.

### C18. Til challenge 🟡
- Mening challenge'larim (progress halqasi: 180/300 so'z, 6/10 kun).
- [Yangi challenge]: til, maqsad, kunlar soni.
- Kunlik kiritish: "Bugun nechta so'z yodladingiz?"
- Umumiy (admin e'lon qilgan) challenge'lar va ularning reytingi.
- Profilda ko'rinadi.

### C19. Maqsadlar 🟡
Oliy maqsad (eng tepada) → kichik maqsadlar → ularga bog'langan odatlar.

### C20. Motivatsiyalar 🟢
- Banner karuseli (`motivations`).
- Kun motivatsiyasi (katta kartochka).
- Lenta: kategoriyalar bo'yicha, saqlash ❤, ulashish.

### C21. Bildirishnomalar qutisi 🟢

### C22. Profil 🟢
- **Eng tepada: "Don't forget why you started!"** + oliy maqsad.
- Avatar, ism, kimligi, daraja/XP 🟡.
- Asosiy raqamlar: streak, bu hafta %, jami bajarilgan.
- Nishonlar 🟡.
- Challenge progresslari 🟡.
- [Profilni tahrirlash] [Sozlamalar].

### C23. Profilni tahrirlash 🟢
Rasm (kesish bilan), ism, kimligi, tug'ilgan yil, shahar, oliy maqsad, qiziqishlar.

### C24. Sozlamalar 🟢
- **Til:** O'zbekcha / Русский / English.
- Mavzu: tizim / yorug' / tungi.
- Bildirishnomalar: kechki xulosa vaqti, maqsad eslatmasi chastotasi, motivatsiyalar, admin xabarlari.
- Namoz sozlamalari.
- Streak muzlatishlari (qolgan soni).
- Maxfiylik (v2 da muhim): profil ochiq / do'stlar / yopiq, nimalar ko'rinadi.
- Akkaunt: email, parol, Google ulash, **ma'lumotlarni eksport qilish**, **akkauntni o'chirish**.
- Premium 🔵.
- Ilova haqida, yordam, fikr bildirish.

### C25. Budilnik ekrani 📱 🟡
To'liq ekran, katta soat, motivatsiya + oliy maqsad. Qat'iy rejimda: misol yechish / QR skanerlash / qadam tashlash.

### C26. Widgetlar 📱 🟡
Kichik: bugungi progress. O'rta: navbatdagi 3 vazifa + "Bajardim" tugmasi. Namoz vaqti widgeti.

---

## D. Ijtimoiy 🔵

| # | Ekran |
|---|---|
| D1 | Guruhlar katalogi (Dasturchilar, Matematiklar, Til o'rganuvchilar…) |
| D2 | Guruh sahifasi: a'zolar, haftalik reyting, a'zolarning ochiq kun tartiblari |
| D3 | Guruh yaratish / sozlash |
| D4 | Do'stlar: ro'yxat, so'rovlar, qidirish |
| D5 | Boshqa foydalanuvchi profili → kun tartibini ko'rish, [Nusxa olish] |
| D6 | Sherik (accountability): taklif, holat, xabarlar |
| D7 | Global reyting |

---

## E. Admin panel

Web: `/admin`. Mobil: Profil → "Admin" (faqat admin rolida ko'rinadi). Kirish — oddiy login + **2FA kodi**.

| # | Ekran | Web | Mobil |
|---|---|---|---|
| E1 | Dashboard: DAU/MAU, yangi ro'yxatlar, retention (D1/D7/D30), o'rtacha bajarish %, AI so'rovlari, eng ko'p tashlab ketilgan odatlar | ✅ | ✅ (qisqa) |
| E2 | Foydalanuvchilar: qidirish, filtr, tafsilot, bloklash, rol berish | ✅ | ✅ |
| E3 | Motivatsiyalar: CRUD, 3 tilda, "kun motivatsiyasi" sanasi | ✅ | ✅ |
| E4 | Bannerlar: CRUD, rasm yuklash (mobil/desktop), joylashuv, auditoriya, sana oralig'i, ko'rishlar/bosishlar | ✅ | ✅ |
| E5 | Push kampaniyalar: segment tanlash, matn 3 tilda, rejalashtirish, natija | ✅ | ✅ |
| E6 | Shablonlar katalogi | ✅ | — |
| E7 | Umumiy challenge'lar | ✅ | ✅ |
| E8 | AI provayderlar: tartib, yoqish/o'chirish, kunlik so'rovlar, xatolar, cooldown holati | ✅ | ✅ (ko'rish) |
| E9 | Nishonlar (badges) | ✅ | — |
| E10 | Sozlamalar / feature flag'lar (AI limiti, muzlatishlar soni…) | ✅ | — |
| E11 | Rasmiy namoz taqvimini yuklash (CSV) | ✅ | — |
| E12 | Audit log | ✅ | — |
| E13 | Guruhlar moderatsiyasi, shikoyatlar 🔵 | ✅ | ✅ |
| E14 | To'lovlar va obunalar 🔵 | ✅ | — |

---

## F. B2B panel 🔵 🌐
Tashkilot → sinflar → o'quvchilar (rozilik bilan) → har birining haftalik natijasi, sinf o'rtachasi, eksport.

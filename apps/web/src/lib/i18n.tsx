"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { appEn, appRu, appUz, type AppKey } from "./messages-app";

export type Lang = "uz" | "ru" | "en";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "O'zbekcha" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
];

const STORAGE_KEY = "dailer.lang";

const uz = {
  "brand.motto": "Don't forget why you started!",
  "nav.login": "Kirish",
  "nav.start": "Boshlash",

  "hero.eyebrow": "Kun tartibi · Intizom · O'sish",
  "hero.title1": "Vaqt kam emas.",
  "hero.title2": "Tartib kam.",
  "hero.lead":
    "Maqsadga yetish uchun 24/7 ishlash shart emas. Har kuni ozgina, lekin to'xtamasdan — Dailer kuningizni tartibga soladi va o'sishingizni ko'rsatib turadi.",
  "hero.cta": "Bepul boshlash",
  "hero.secondary": "Menda akkaunt bor",
  "hero.today": "Bugun",
  "hero.done": "bajarildi",
  "hero.week": "o'tgan haftadan",
  "demo.wake": "Uyg'onish",
  "demo.fajr": "Bomdod namozi",
  "demo.reading": "Kitob o'qish · 20 bet",
  "demo.classes": "Darslar",
  "demo.sport": "Sport",
  "pillar1.title": "24/7 emas",
  "pillar1.text": "Har kuni ozgina, lekin to'xtamasdan. Davomiylik — eng kuchli tezlik.",
  "pillar2.title": "Tartib > motivatsiya",
  "pillar2.text": "Motivatsiya keladi va ketadi. Tartib esa ertalab soat 5:00 da ham ishlaydi.",
  "pillar3.title": "O'sishni ko'ring",
  "pillar3.text": "Haftalik hisobot: namoz, kitob, sport — qaysi kuni qildingiz, o'tgan haftadan qanchalik yaxshi.",

  "auth.email": "Email",
  "auth.password": "Parol",
  "auth.name": "Ismingiz",
  "auth.newPassword": "Yangi parol",
  "auth.repeatPassword": "Parolni takrorlang",
  "auth.passwordHint": "Kamida 8 belgi, harf va raqam",
  "auth.or": "yoki",
  "auth.google": "Google bilan davom etish",

  "login.title": "Qaytganingizdan xursandmiz",
  "login.subtitle": "Kuningizni davom ettiramiz.",
  "login.submit": "Kirish",
  "login.forgot": "Parolni unutdingizmi?",
  "login.noAccount": "Akkauntingiz yo'qmi?",
  "login.register": "Ro'yxatdan o'ting",

  "twofa.title": "Ikki bosqichli tasdiqlash",
  "twofa.subtitle": "Autentifikator ilovasidagi 6 xonali kodni yoki zaxira kodni kiriting.",
  "twofa.code": "Kod",
  "twofa.submit": "Tasdiqlash",

  "register.title": "Yangi boshlanish",
  "register.subtitle": "Bir daqiqada akkaunt oching — qolganini birga tartibga solamiz.",
  "register.submit": "Ro'yxatdan o'tish",
  "register.haveAccount": "Akkauntingiz bormi?",
  "register.terms": "Ro'yxatdan o'tib, foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz.",

  "forgot.title": "Parolni tiklash",
  "forgot.subtitle": "Emailingizni kiriting — tiklash havolasini yuboramiz.",
  "forgot.submit": "Havola yuborish",
  "forgot.sent": "Agar bu email ro'yxatdan o'tgan bo'lsa, unga havola yubordik. Pochtangizni tekshiring.",
  "forgot.back": "Kirish sahifasiga qaytish",

  "reset.title": "Yangi parol",
  "reset.subtitle": "Yangi parolni o'rnating — boshqa qurilmalardagi sessiyalar yopiladi.",
  "reset.submit": "Parolni saqlash",
  "reset.done": "Parol yangilandi. Endi yangi parol bilan kiring.",
  "reset.mismatch": "Parollar bir xil emas.",
  "reset.noToken": "Havola noto'g'ri. Qaytadan so'rang.",

  "verify.loading": "Email tasdiqlanmoqda…",
  "verify.done": "Email tasdiqlandi! Endi to'liq foydalanishingiz mumkin.",
  "verify.continue": "Davom etish",
  "verify.banner": "Emailingizni tasdiqlang — havolani pochtangizga yubordik.",
  "verify.resend": "Qayta yuborish",
  "verify.resent": "Yuborildi",

  "today.hello": "Assalomu alaykum",
  "today.goal": "Oliy maqsadingiz",
  "today.noGoal": "Oliy maqsadingizni hali yozmadingiz.",
  "today.soon": "Kun tartibi bo'limi tez orada shu yerda bo'ladi.",
  "today.logout": "Chiqish",

  "error.network": "Server bilan aloqa yo'q. Internetni tekshiring.",
  "error.generic": "Nimadir xato ketdi. Qayta urinib ko'ring.",
} as const;

type BaseKey = keyof typeof uz;
type Messages = Record<BaseKey, string>;
export type MessageKey = BaseKey | AppKey;

const ru: Messages = {
  "brand.motto": "Don't forget why you started!",
  "nav.login": "Войти",
  "nav.start": "Начать",
  "hero.eyebrow": "Распорядок · Дисциплина · Рост",
  "hero.title1": "Времени достаточно.",
  "hero.title2": "Не хватает порядка.",
  "hero.lead":
    "Чтобы достичь цели, не нужно работать 24/7. Понемногу, но каждый день — Dailer упорядочит ваш день и покажет ваш рост.",
  "hero.cta": "Начать бесплатно",
  "hero.secondary": "У меня есть аккаунт",
  "hero.today": "Сегодня",
  "hero.done": "выполнено",
  "hero.week": "к прошлой неделе",
  "demo.wake": "Подъём",
  "demo.fajr": "Утренний намаз",
  "demo.reading": "Чтение · 20 страниц",
  "demo.classes": "Занятия",
  "demo.sport": "Спорт",
  "pillar1.title": "Не 24/7",
  "pillar1.text": "Понемногу, но каждый день. Постоянство — самая сильная скорость.",
  "pillar2.title": "Порядок > мотивация",
  "pillar2.text": "Мотивация приходит и уходит. Порядок работает даже в 5:00 утра.",
  "pillar3.title": "Видите свой рост",
  "pillar3.text": "Недельный отчёт: намаз, книги, спорт — в какие дни сделали и насколько лучше прошлой недели.",
  "auth.email": "Email",
  "auth.password": "Пароль",
  "auth.name": "Ваше имя",
  "auth.newPassword": "Новый пароль",
  "auth.repeatPassword": "Повторите пароль",
  "auth.passwordHint": "Минимум 8 символов, буквы и цифры",
  "auth.or": "или",
  "auth.google": "Продолжить с Google",
  "login.title": "Рады вас видеть",
  "login.subtitle": "Продолжим ваш день.",
  "login.submit": "Войти",
  "login.forgot": "Забыли пароль?",
  "login.noAccount": "Нет аккаунта?",
  "login.register": "Зарегистрируйтесь",
  "twofa.title": "Двухфакторная проверка",
  "twofa.subtitle": "Введите 6-значный код из приложения-аутентификатора или резервный код.",
  "twofa.code": "Код",
  "twofa.submit": "Подтвердить",
  "register.title": "Новое начало",
  "register.subtitle": "Создайте аккаунт за минуту — остальное упорядочим вместе.",
  "register.submit": "Зарегистрироваться",
  "register.haveAccount": "Уже есть аккаунт?",
  "register.terms": "Регистрируясь, вы принимаете условия использования и политику конфиденциальности.",
  "forgot.title": "Восстановление пароля",
  "forgot.subtitle": "Введите email — мы отправим ссылку для сброса.",
  "forgot.submit": "Отправить ссылку",
  "forgot.sent": "Если этот email зарегистрирован, мы отправили на него ссылку. Проверьте почту.",
  "forgot.back": "Вернуться ко входу",
  "reset.title": "Новый пароль",
  "reset.subtitle": "Установите новый пароль — сеансы на других устройствах будут закрыты.",
  "reset.submit": "Сохранить пароль",
  "reset.done": "Пароль обновлён. Войдите с новым паролем.",
  "reset.mismatch": "Пароли не совпадают.",
  "reset.noToken": "Неверная ссылка. Запросите новую.",
  "verify.loading": "Подтверждаем email…",
  "verify.done": "Email подтверждён! Теперь доступны все функции.",
  "verify.continue": "Продолжить",
  "verify.banner": "Подтвердите email — мы отправили ссылку на вашу почту.",
  "verify.resend": "Отправить снова",
  "verify.resent": "Отправлено",
  "today.hello": "Ассаляму алейкум",
  "today.goal": "Ваша главная цель",
  "today.noGoal": "Вы ещё не написали свою главную цель.",
  "today.soon": "Раздел распорядка дня скоро появится здесь.",
  "today.logout": "Выйти",
  "error.network": "Нет связи с сервером. Проверьте интернет.",
  "error.generic": "Что-то пошло не так. Попробуйте ещё раз.",
};

const en: Messages = {
  "brand.motto": "Don't forget why you started!",
  "nav.login": "Sign in",
  "nav.start": "Get started",
  "hero.eyebrow": "Routine · Discipline · Growth",
  "hero.title1": "Time isn't short.",
  "hero.title2": "Order is.",
  "hero.lead":
    "You don't need to work 24/7 to reach your goal. A little every day, without stopping — Dailer brings order to your day and shows your growth.",
  "hero.cta": "Start for free",
  "hero.secondary": "I have an account",
  "hero.today": "Today",
  "hero.done": "done",
  "hero.week": "vs last week",
  "demo.wake": "Wake up",
  "demo.fajr": "Fajr prayer",
  "demo.reading": "Reading · 20 pages",
  "demo.classes": "Classes",
  "demo.sport": "Workout",
  "pillar1.title": "Not 24/7",
  "pillar1.text": "A little every day, without stopping. Consistency is the strongest speed.",
  "pillar2.title": "Order > motivation",
  "pillar2.text": "Motivation comes and goes. Order works even at 5:00 a.m.",
  "pillar3.title": "See your growth",
  "pillar3.text": "Weekly report: prayer, reading, sport — which days you did it and how much better than last week.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.name": "Your name",
  "auth.newPassword": "New password",
  "auth.repeatPassword": "Repeat password",
  "auth.passwordHint": "At least 8 characters, letters and digits",
  "auth.or": "or",
  "auth.google": "Continue with Google",
  "login.title": "Good to see you again",
  "login.subtitle": "Let's continue your day.",
  "login.submit": "Sign in",
  "login.forgot": "Forgot password?",
  "login.noAccount": "No account yet?",
  "login.register": "Sign up",
  "twofa.title": "Two-step verification",
  "twofa.subtitle": "Enter the 6-digit code from your authenticator app or a backup code.",
  "twofa.code": "Code",
  "twofa.submit": "Verify",
  "register.title": "A fresh start",
  "register.subtitle": "Create an account in a minute — we'll organize the rest together.",
  "register.submit": "Create account",
  "register.haveAccount": "Already have an account?",
  "register.terms": "By signing up you agree to the terms of use and privacy policy.",
  "forgot.title": "Reset password",
  "forgot.subtitle": "Enter your email — we'll send a reset link.",
  "forgot.submit": "Send link",
  "forgot.sent": "If this email is registered, we've sent it a link. Check your inbox.",
  "forgot.back": "Back to sign in",
  "reset.title": "New password",
  "reset.subtitle": "Set a new password — sessions on other devices will be signed out.",
  "reset.submit": "Save password",
  "reset.done": "Password updated. Sign in with your new password.",
  "reset.mismatch": "Passwords don't match.",
  "reset.noToken": "Invalid link. Please request a new one.",
  "verify.loading": "Verifying your email…",
  "verify.done": "Email verified! You now have full access.",
  "verify.continue": "Continue",
  "verify.banner": "Please confirm your email — we've sent a link to your inbox.",
  "verify.resend": "Resend",
  "verify.resent": "Sent",
  "today.hello": "Assalamu alaykum",
  "today.goal": "Your highest goal",
  "today.noGoal": "You haven't written your highest goal yet.",
  "today.soon": "Your daily routine will appear here soon.",
  "today.logout": "Sign out",
  "error.network": "Can't reach the server. Check your connection.",
  "error.generic": "Something went wrong. Please try again.",
};

const DICTS: Record<Lang, Record<MessageKey, string>> = {
  uz: { ...uz, ...appUz },
  ru: { ...ru, ...appRu },
  en: { ...en, ...appEn },
};

type Vars = Record<string, string | number>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: MessageKey, vars?: Vars) => string };
const I18nContext = createContext<Ctx | null>(null);

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "uz" || v === "ru" || v === "en") return v;
  } catch {}
  return "uz";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Server va birinchi render — o'zbekcha; keyin saqlangan til qo'llanadi
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    setLangState(readStoredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (k: MessageKey, vars?: Vars) => {
      let s = DICTS[lang][k] ?? DICTS.uz[k] ?? k;
      if (vars) for (const [name, v] of Object.entries(vars)) s = s.replaceAll(`{${name}}`, String(v));
      return s;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

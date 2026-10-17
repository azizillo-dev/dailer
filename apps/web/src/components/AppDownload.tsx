"use client";

import { Check, Download, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** GitHub Releases — har doim oxirgi versiya (yangi release chiqqanda havola o'zgarmaydi). */
export const APK_URL =
  process.env.NEXT_PUBLIC_ANDROID_APK_URL || "https://github.com/azizillo-dev/dailer/releases/latest/download/dailer.apk";
export const APK_VERSION = process.env.NEXT_PUBLIC_ANDROID_APK_VERSION || "1.0.0";
export const APK_SIZE = process.env.NEXT_PUBLIC_ANDROID_APK_SIZE || "23 MB";

const BAR_KEY = "dailer.dl.bar";
const PROMPT_KEY = "dailer.dl.prompt";

function storage(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Android brauzeri (ilovaning o'zi emas). */
export function useIsAndroid() {
  const [android, setAndroid] = useState(false);
  useEffect(() => {
    setAndroid(/Android/i.test(navigator.userAgent));
  }, []);
  return android;
}

export function AndroidIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.5 11.5 0 0 0-9.84 0L5.22 5.92a.38.38 0 1 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

/** Sahifa tepasidagi ingichka tasma — landing, kirish va ro'yxatdan o'tishda. Yopilsa, qaytib chiqmaydi. */
export function DownloadBar() {
  const { t } = useI18n();
  const android = useIsAndroid();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(storage("local")?.getItem(BAR_KEY) !== "closed");
  }, []);
  if (!shown) return null;
  return (
    <div className="relative z-40 bg-espresso text-cream">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
        <AndroidIcon className="h-4 w-4 shrink-0 text-caramel" />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">{t("dl.bar")}</p>
        <a
          href={android ? APK_URL : "/download"}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-caramel px-3.5 text-xs font-bold text-espresso transition-opacity hover:opacity-90"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("dl.button")}</span>
          <span className="sm:hidden">{t("dl.short")}</span>
        </a>
        <button
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-latte/70 hover:text-cream"
          aria-label={t("dl.close")}
          onClick={() => {
            storage("local")?.setItem(BAR_KEY, "closed");
            setShown(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Android telefonda kirish/ro'yxatdan o'tishdan oldin — pastdan chiqadigan taklif (sessiyada bir marta). */
export function AndroidPrompt() {
  const { t } = useI18n();
  const android = useIsAndroid();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (android && storage("session")?.getItem(PROMPT_KEY) !== "seen") setOpen(true);
  }, [android]);
  const close = () => {
    storage("session")?.setItem(PROMPT_KEY, "seen");
    setOpen(false);
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="dl-title">
      <button className="absolute inset-0 bg-espresso/60 backdrop-blur-[2px]" aria-label={t("dl.close")} onClick={close} />
      <div className="animate-rise relative w-full max-w-md rounded-t-[28px] bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-line">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-espresso text-caramel">
            <AndroidIcon className="h-6 w-6" />
          </span>
          <h2 id="dl-title" className="font-serif text-2xl">
            {t("dl.promptTitle")}
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("dl.promptText")}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {(["dl.f1", "dl.f2", "dl.f3"] as const).map((k) => (
            <li key={k} className="flex gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-highlight" />
              {t(k)}
            </li>
          ))}
        </ul>
        <a href={APK_URL} onClick={close} className="btn-primary mt-6 flex h-12 w-full items-center justify-center gap-2 text-base">
          <Download className="h-4 w-4" /> {t("dl.button")}
        </a>
        <button onClick={close} className="btn-ghost mt-2 h-12 w-full text-sm">
          {t("dl.continueWeb")}
        </button>
        <Link href="/download" onClick={close} className="mt-3 block text-center text-xs font-semibold text-highlight">
          {t("dl.howTo")}
        </Link>
      </div>
    </div>
  );
}

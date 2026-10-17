"use client";

import { usePathname } from "next/navigation";
import { AndroidPrompt, DownloadBar } from "./AppDownload";
import { LangSwitch } from "./LangSwitch";
import { Logo, LogoMark } from "./Logo";
import { useI18n } from "@/lib/i18n";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  // Ilovani o'rnatish taklifi — akkaunt ochish/kirishdan oldin
  const offerApp = pathname === "/login" || pathname === "/register";
  return (
    <>
    {offerApp && <DownloadBar />}
    {offerApp && <AndroidPrompt />}
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      {/* Chap panel — faqat katta ekranda */}
      <aside className="bg-sunrise relative hidden overflow-hidden p-12 text-espresso lg:flex lg:flex-col lg:justify-between">
        <Logo className="text-espresso" />
        <div>
          <LogoMark className="mb-8 h-14 w-14 text-espresso" />
          <p className="font-serif text-5xl leading-[1.08] tracking-tight">“{t("brand.motto")}”</p>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-espresso/75">{t("hero.lead")}</p>
        </div>
        <div
          className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-cream/30 blur-3xl"
          aria-hidden
        />
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Logo />
          </span>
          <LangSwitch />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="animate-rise font-serif text-4xl tracking-tight">{title}</h1>
          {subtitle && (
            <p className="animate-rise mt-3 text-ink-soft" style={{ animationDelay: "0.06s" }}>
              {subtitle}
            </p>
          )}
          <div className="animate-rise mt-8" style={{ animationDelay: "0.12s" }}>
            {children}
          </div>
        </div>
      </main>
    </div>
    </>
  );
}

export function FormMessage({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
        kind === "error" ? "bg-danger/10 text-danger" : "bg-success/12 text-success"
      }`}
    >
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink-soft">{label}</span>
      <input className="field" {...props} />
      {hint && <span className="mt-1.5 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

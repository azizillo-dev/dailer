"use client";

import { BarChart3, Bell, CalendarCheck2, ListTodo, LogOut, Sparkles, Timer, Trophy, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { applyTheme, storedTheme } from "@/lib/theme";

const NAV: { href: string; label: MessageKey; icon: typeof ListTodo; mobile: boolean }[] = [
  { href: "/today", label: "nav.today", icon: CalendarCheck2, mobile: true },
  { href: "/stats", label: "nav.stats", icon: BarChart3, mobile: true },
  { href: "/ai", label: "nav.ai", icon: Sparkles, mobile: true },
  { href: "/focus", label: "nav.focus", icon: Timer, mobile: true },
  { href: "/routine", label: "nav.routine", icon: ListTodo, mobile: false },
  { href: "/challenges", label: "nav.challenges", icon: Trophy, mobile: false },
  { href: "/profile", label: "nav.profile", icon: UserRound, mobile: true },
];
const MOBILE_NAV = NAV.filter((n) => n.mobile);

function VerifyBanner() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-soft">{t("verify.banner")}</p>
      <button
        className="btn-ghost h-9 shrink-0 px-4 text-sm"
        disabled={sent}
        onClick={async () => {
          await api("/api/v1/auth/resend-verification", { method: "POST", auth: true }).catch(() => {});
          setSent(true);
        }}
      >
        {sent ? `✓ ${t("verify.resent")}` : t("verify.resend")}
      </button>
    </div>
  );
}

/** Kirgan foydalanuvchi sahifalari uchun qobiq. Onboarding o'tilmagan bo'lsa — o'sha yerga. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  // Sarlavhadagi til tanlagich — server ham shu tilda xat va xabar yuborsin
  useEffect(() => {
    if (!me || me.profile.language === lang) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("dailer.lang");
    } catch {}
    if (!stored) {
      // Yangi qurilma — profildagi tilni olamiz
      setLang(me.profile.language);
    } else {
      api("/api/v1/me/profile", { method: "PATCH", auth: true, body: { language: lang } }).catch(() => {});
    }
  }, [lang, me, setLang]);

  // O'qilmagan xabarlar soni: ochilganda, har daqiqada va xabar o'qilganda
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!me) return;
    const load = () =>
      api<{ count: number }>("/api/v1/notifications/unread-count", { auth: true })
        .then((r) => setUnread(r.count))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    window.addEventListener("dailer:notifications", load);
    return () => {
      clearInterval(id);
      window.removeEventListener("dailer:notifications", load);
    };
  }, [me]);

  // Yangi qurilmada profildagi mavzuni qo'llash
  useEffect(() => {
    if (me && storedTheme() === "system" && me.profile.theme !== "system") applyTheme(me.profile.theme);
  }, [me]);

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/login");
    else if (!me.profile.onboarding_completed_at) router.replace("/onboarding");
  }, [loading, me, router]);

  if (!me || !me.profile.onboarding_completed_at) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-highlight" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/today" />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors lg:px-4 ${
                  pathname.startsWith(n.href) ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                {t(n.label)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <LangSwitch />
            </div>
            <Link
              href="/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full text-ink-soft ring-1 ring-line transition-colors hover:text-ink"
              aria-label={`${t("notif.title")}${unread ? ` (${unread})` : ""}`}
              title={t("notif.title")}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-highlight px-1 text-[10px] font-black text-espresso">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
              className="grid h-10 w-10 place-items-center rounded-full text-ink-soft ring-1 ring-line transition-colors hover:text-ink"
              title={t("today.logout")}
              aria-label={t("today.logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        {!me.email_verified && <VerifyBanner />}
        {children}
      </main>

      {/* Mobil pastki navigatsiya */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${MOBILE_NAV.length}, 1fr)` }}>
          {MOBILE_NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors ${
                  active ? "text-highlight" : "text-ink-faint"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                {t(n.label)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

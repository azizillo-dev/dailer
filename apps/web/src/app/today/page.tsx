"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function TodayPage() {
  const { t } = useI18n();
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (!me) return null;

  const firstName = me.profile.full_name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6">
      <header className="flex h-20 items-center justify-between">
        <Logo href="/today" />
        <div className="flex items-center gap-2">
          <LangSwitch />
          <button
            onClick={async () => {
              await logout();
              router.replace("/");
            }}
            className="btn-ghost h-10 px-4 text-sm"
          >
            {t("today.logout")}
          </button>
        </div>
      </header>

      {!me.email_verified && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">{t("verify.banner")}</p>
          <button
            className="btn-ghost h-9 shrink-0 px-4 text-sm"
            disabled={resent}
            onClick={async () => {
              await api("/api/v1/auth/resend-verification", { method: "POST", auth: true }).catch(() => {});
              setResent(true);
            }}
          >
            {resent ? `✓ ${t("verify.resent")}` : t("verify.resend")}
          </button>
        </div>
      )}

      {/* Profil va Bugun ekranining tepasi: "Don't forget why you started!" */}
      <section className="card animate-rise overflow-hidden">
        <div className="bg-espresso px-6 py-5 text-cream sm:px-8">
          <p className="font-serif text-xl italic sm:text-2xl">“{t("brand.motto")}”</p>
        </div>
        <div className="px-6 py-6 sm:px-8">
          <p className="eyebrow">{t("today.goal")}</p>
          <p className="mt-2 font-serif text-2xl leading-snug">
            {me.profile.main_goal ?? <span className="text-ink-faint">{t("today.noGoal")}</span>}
          </p>
        </div>
      </section>

      <h1 className="animate-rise mt-10 font-serif text-4xl tracking-tight" style={{ animationDelay: "0.08s" }}>
        {t("today.hello")}, {firstName}!
      </h1>
      <div className="mt-6 animate-rise" style={{ animationDelay: "0.16s" }}>
        <FormMessage kind="success">{t("today.soon")}</FormMessage>
      </div>
    </div>
  );
}

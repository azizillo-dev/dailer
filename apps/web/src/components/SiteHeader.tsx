"use client";

import Link from "next/link";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function SiteHeader() {
  const { t } = useI18n();
  const { me } = useAuth();
  return (
    <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <Logo />
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:block">
          <LangSwitch />
        </div>
        {me ? (
          <Link href="/today" className="btn-primary h-10 px-5 text-sm">
            {t("hero.today")}
          </Link>
        ) : (
          <>
            <Link href="/login" className="hidden h-10 px-3 text-sm font-semibold text-ink-soft hover:text-ink sm:inline-flex sm:items-center">
              {t("nav.login")}
            </Link>
            <Link href="/register" className="btn-primary h-10 px-5 text-sm">
              {t("nav.start")}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { DayStory } from "@/components/landing/DayStory";
import { AIDemo, FAQ, Features, FinalCTA, Motto, Quotes, StatsShowcase } from "@/components/landing/Sections";
import { LangSwitch } from "@/components/LangSwitch";
import { SiteHeader } from "@/components/SiteHeader";
import { TodayDemo } from "@/components/TodayDemo";
import { useI18n, type MessageKey } from "@/lib/i18n";

const PILLARS: { n: string; title: MessageKey; text: MessageKey }[] = [
  { n: "01", title: "pillar1.title", text: "pillar1.text" },
  { n: "02", title: "pillar2.title", text: "pillar2.text" },
  { n: "03", title: "pillar3.title", text: "pillar3.text" },
];

export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-14 pt-6 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pt-16">
          <div>
            <p className="eyebrow animate-rise">{t("hero.eyebrow")}</p>
            <h1 className="mt-5 font-serif text-[clamp(2.6rem,8vw,5rem)] leading-[1.02] tracking-[-0.02em]">
              <span className="animate-rise block" style={{ animationDelay: "0.08s" }}>
                {t("hero.title1")}
              </span>
              <span className="animate-rise block italic text-highlight" style={{ animationDelay: "0.16s" }}>
                {t("hero.title2")}
              </span>
            </h1>
            <p className="animate-rise mt-6 max-w-xl text-[17px] leading-relaxed text-ink-soft" style={{ animationDelay: "0.24s" }}>
              {t("hero.lead")}
            </p>
            <div className="animate-rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "0.32s" }}>
              <Link href="/register" className="btn-primary h-14 px-8 text-base">
                {t("hero.cta")} →
              </Link>
              <Link href="/login" className="btn-ghost h-14 px-8 text-base">
                {t("hero.secondary")}
              </Link>
            </div>
            <p className="animate-rise mt-10 font-serif text-lg italic text-ink-faint" style={{ animationDelay: "0.4s" }}>
              “{t("brand.motto")}”
            </p>
          </div>

          <div className="relative px-2 sm:px-6">
            <div className="pointer-events-none absolute inset-x-10 -inset-y-6 -z-10 rounded-full bg-caramel/20 blur-3xl" aria-hidden />
            <TodayDemo />
          </div>
        </section>

        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.n} className="card p-7">
              <span className="font-serif text-sm text-highlight">{p.n}</span>
              <h2 className="mt-3 font-serif text-2xl">{t(p.title)}</h2>
              <p className="mt-3 leading-relaxed text-ink-soft">{t(p.text)}</p>
            </article>
          ))}
        </section>
      </main>

      <div className="mx-auto mt-24 max-w-6xl px-4 text-center sm:px-6">
        <p className="eyebrow">{t("l.story.eyebrow")}</p>
        <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">{t("l.story.title")}</h2>
      </div>
      <DayStory />
      <Quotes />
      <Features />
      <StatsShowcase />
      <AIDemo />
      <Motto />
      <FAQ />
      <FinalCTA />
      <footer className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 border-t border-line px-4 py-8 text-sm text-ink-faint sm:flex-row sm:px-6">
        <span>© {new Date().getFullYear()} Dailer · “{t("brand.motto")}”</span>
        <LangSwitch />
      </footer>
    </>
  );
}

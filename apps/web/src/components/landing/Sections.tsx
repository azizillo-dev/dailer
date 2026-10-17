"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WeekBars, type DayRow } from "@/components/charts";
import { ItemIcon } from "@/components/ItemIcon";
import { LogoMark } from "@/components/Logo";
import { ProgressRing } from "@/components/ProgressRing";
import { useI18n, type MessageKey } from "@/lib/i18n";

/** Element ko'rinishga kirganda bir marta `true` bo'ladi. */
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen] as const;
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out-soft ${seen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

const FEATURES = [
  { icon: "list", key: "f1" },
  { icon: "moon", key: "f2" },
  { icon: "target", key: "f3" },
  { icon: "sparkle", key: "f4" },
  { icon: "activity", key: "f5" },
  { icon: "heart", key: "f6" },
] as const;

export function Features() {
  const { t } = useI18n();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <Reveal>
        <p className="eyebrow">{t("l.features.eyebrow")}</p>
        <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{t("l.features.title")}</h2>
      </Reveal>
      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.key} delay={i * 0.06}>
            <article className="card group h-full p-7 transition-transform duration-300 hover:-translate-y-1">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-highlight transition-transform duration-300 group-hover:scale-110">
                <ItemIcon name={f.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-serif text-2xl">{t(`l.${f.key}.title` as MessageKey)}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{t(`l.${f.key}.text` as MessageKey)}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const DEMO_DAYS: DayRow[] = [62, 78, 71, 85, 90, 68, 88].map((score, i) => ({
  date: `2026-10-${String(12 + i).padStart(2, "0")}`,
  planned: 12,
  done: Math.round((score / 100) * 12),
  partial: 0,
  missed: 12 - Math.round((score / 100) * 12),
  excused: 0,
  score,
}));

const DEMO_CATS: { cat: string; icon: string; v: number }[] = [
  { cat: "cat.prayer", icon: "moon", v: 96 },
  { cat: "cat.reading", icon: "book", v: 74 },
  { cat: "cat.sport", icon: "dumbbell", v: 58 },
  { cat: "cat.language", icon: "languages", v: 81 },
];

export function StatsShowcase() {
  const { t, lang } = useI18n();
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  return (
    <section className="bg-surface-2/60 py-24 sm:py-32">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow">{t("l.stats.eyebrow")}</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{t("l.stats.title")}</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">{t("l.stats.text")}</p>
        </Reveal>
        <div ref={ref} className="card p-6 sm:p-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-soft">{t("l.stats.week")}</p>
              <p className="font-serif text-6xl leading-none">
                77<span className="text-3xl text-ink-faint">%</span>
              </p>
            </div>
            <span className="rounded-full bg-success/12 px-3 py-1 text-xs font-bold text-success">▲ 18% {t("hero.week")}</span>
          </div>
          <div className="mt-8">{seen && <WeekBars days={DEMO_DAYS} lang={lang} today="" labels={{ open: "", none: "", doneOf: (d) => t("today.of", { done: d.done, total: d.planned }) }} />}</div>
          <div className="mt-8 grid grid-cols-4 gap-2">
            {DEMO_CATS.map((c) => (
              <div key={c.cat} className="flex flex-col items-center text-center">
                <ProgressRing value={seen ? c.v / 100 : 0} size={64} stroke={6}>
                  <span className="text-highlight">
                    <ItemIcon name={c.icon} className="h-4 w-4" />
                  </span>
                </ProgressRing>
                <p className="mt-2 truncate text-xs font-semibold">{t(c.cat as MessageKey)}</p>
                <p className="text-xs text-ink-faint">{c.v}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AIDemo() {
  const { t } = useI18n();
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const [typed, setTyped] = useState(0);
  const reply = t("l.ai.reply");

  useEffect(() => {
    if (!seen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyped(reply.length);
      return;
    }
    setTyped(0);
    let i = 0;
    const start = setTimeout(function tick() {
      i += 3;
      setTyped(Math.min(i, reply.length));
      if (i < reply.length) timer = setTimeout(tick, 22);
    }, 900);
    let timer = start;
    return () => clearTimeout(timer);
  }, [seen, reply]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal className="lg:order-2">
          <p className="eyebrow">{t("l.ai.eyebrow")}</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{t("l.ai.title")}</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">{t("l.f4.text")}</p>
        </Reveal>
        <div ref={ref} className="card space-y-4 p-5 sm:p-7 lg:order-1">
          <div className={`flex justify-end transition-[opacity,transform] duration-500 ${seen ? "opacity-100" : "translate-y-3 opacity-0"}`}>
            <p className="max-w-[88%] rounded-3xl rounded-tr-md bg-accent px-4 py-3 text-[15px] leading-relaxed text-accent-ink">{t("l.ai.user")}</p>
          </div>
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-highlight">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="min-h-24 max-w-[88%] rounded-3xl rounded-tl-md bg-surface-2 px-4 py-3 text-[15px] leading-relaxed">
              {typed === 0 ? (
                <span className="inline-flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-2 w-2 animate-pulse rounded-full bg-ink-faint" style={{ animationDelay: `${d * 0.15}s` }} />
                  ))}
                </span>
              ) : (
                <>
                  {reply.slice(0, typed)}
                  {typed < reply.length && <span className="caret ml-0.5 inline-block h-4 w-0.5 bg-highlight align-middle" />}
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Quotes() {
  const { t } = useI18n();
  const items = t("l.quotes").split("|");
  return (
    <section className="overflow-hidden border-y border-line py-8" aria-label="Quotes">
      {/* Ikki nusxa ketma-ket: -50% siljiganda chok ko'rinmaydi */}
      <div className="marquee flex w-max hover:[animation-play-state:paused]">
        {[...items, ...items].map((q, i) => (
          <p key={i} className="flex shrink-0 items-center gap-12 pr-12 font-serif text-2xl italic text-ink-soft sm:text-3xl" aria-hidden={i >= items.length}>
            {q}
            <span className="h-2 w-2 rounded-full bg-caramel" />
          </p>
        ))}
      </div>
    </section>
  );
}

export function Motto() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-espresso py-28 text-cream sm:py-40">
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-caramel/20 blur-3xl" aria-hidden />
      <div className="relative mx-auto w-full max-w-4xl px-4 text-center sm:px-6">
        <Reveal>
          <LogoMark className="mx-auto h-14 w-14 text-cream" />
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-latte/80">{t("l.motto.text")}</p>
          <p className="mt-8 font-serif text-[clamp(2.6rem,8vw,5.5rem)] leading-[1.02] tracking-tight">“{t("brand.motto")}”</p>
          <p className="mx-auto mt-8 max-w-xl leading-relaxed text-latte/70">{t("l.motto.goal")}</p>
        </Reveal>
      </div>
    </section>
  );
}

export function FAQ() {
  const { t } = useI18n();
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 sm:py-32">
      <Reveal>
        <h2 className="text-center font-serif text-4xl tracking-tight sm:text-5xl">{t("l.faq.title")}</h2>
      </Reveal>
      <div className="mt-10 space-y-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <details key={n} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold">
              {t(`l.faq.q${n}` as MessageKey)}
              <ChevronDown className="h-5 w-5 shrink-0 text-ink-faint transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <p className="px-6 pb-6 leading-relaxed text-ink-soft">{t(`l.faq.a${n}` as MessageKey)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCTA() {
  const { t } = useI18n();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-caramel via-caramel-deep to-coffee px-6 py-16 text-center text-cream sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cream/15 blur-2xl" aria-hidden />
          <h2 className="relative font-serif text-4xl leading-tight tracking-tight sm:text-6xl">{t("l.cta.title")}</h2>
          <p className="relative mx-auto mt-4 max-w-md text-lg text-cream/85">{t("l.cta.text")}</p>
          <Link href="/register" className="btn relative mt-8 h-14 bg-espresso px-8 text-base text-cream hover:opacity-90">
            {t("hero.cta")} →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

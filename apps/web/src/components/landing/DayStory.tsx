"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ItemIcon } from "@/components/ItemIcon";
import { useI18n, type MessageKey } from "@/lib/i18n";

/** Kunning qadamlari: vaqt (daqiqada) va ikonka. */
const STEPS = [
  { at: 5 * 60, icon: "alarm" },
  { at: 5 * 60 + 30, icon: "sunrise" },
  { at: 5 * 60 + 45, icon: "book" },
  { at: 8 * 60, icon: "graduation" },
  { at: 14 * 60, icon: "laptop" },
  { at: 18 * 60, icon: "dumbbell" },
  { at: 21 * 60, icon: "languages" },
  { at: 22 * 60 + 30, icon: "pen" },
  { at: 23 * 60, icon: "bed" },
];
const START = 5 * 60;
const END = 23 * 60 + 15;

// Osmon qatlamlari va ularning eng yorqin nuqtasi (progress 0..1)
const SKY = [
  { at: 0.0, bg: "linear-gradient(180deg,#2a1e2e 0%,#7a4b3a 55%,#e0a46c 100%)" }, // tong
  { at: 0.3, bg: "linear-gradient(180deg,#d9b48a 0%,#efd3ac 55%,#f7ead6 100%)" }, // kunduz
  { at: 0.68, bg: "linear-gradient(180deg,#5b3426 0%,#b8693f 55%,#e8a15e 100%)" }, // shom
  { at: 1.0, bg: "linear-gradient(180deg,#0f0a08 0%,#1f1510 60%,#33231a 100%)" }, // tun
];

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

export function DayStory() {
  const { t } = useI18n();
  const section = useRef<HTMLElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const sun = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const [minute, setMinute] = useState(START);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let frame = 0;
    let lastMinute = -1;
    const update = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / (total || 1)));

      // Osmon: qo'shni ikki qatlam o'rtasida shaffoflik bilan o'tish
      SKY.forEach((s, i) => {
        const prev = SKY[i - 1]?.at ?? -1;
        const next = SKY[i + 1]?.at ?? 2;
        let o = 0;
        if (p >= prev && p <= s.at) o = i === 0 ? 1 : (p - prev) / (s.at - prev);
        else if (p > s.at && p <= next) o = i === SKY.length - 1 ? 1 : 1 - (p - s.at) / (next - s.at);
        const node = layers.current[i];
        if (node) node.style.opacity = String(o);
      });

      // Quyosh yoy bo'ylab (faqat transform)
      const sp = Math.min(1, Math.max(0, (p - 0.02) / 0.72));
      // Yuqori qismda — matn ustidan o'tmasin
      const x = -8 + sp * 116;
      const y = 26 - Math.sin(sp * Math.PI) * 20;
      if (sun.current) {
        sun.current.style.transform = `translate3d(${x}vw, ${y}vh, 0)`;
        sun.current.style.opacity = p > 0.8 ? "0" : "1";
      }
      if (moon.current) {
        moon.current.style.opacity = p > 0.78 ? String(Math.min(1, (p - 0.78) / 0.12)) : "0";
        moon.current.style.transform = `translate3d(0, ${(1 - Math.min(1, (p - 0.78) / 0.22)) * 40}px, 0)`;
      }

      const m = Math.round(START + p * (END - START));
      if (m !== lastMinute) {
        lastMinute = m;
        setMinute(m);
        let s = 0;
        STEPS.forEach((st, i) => {
          if (m >= st.at) s = i;
        });
        setStep(s);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Osmon to'q bo'lgan paytda matn och rangda
  const dark = minute < 6 * 60 + 30 || minute > 17 * 60 + 30;

  return (
    <section ref={section} className="relative h-[520vh]" aria-label={t("l.story.title")}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* Osmon */}
        {SKY.map((s, i) => (
          <div
            key={i}
            ref={(n) => {
              layers.current[i] = n;
            }}
            className="absolute inset-0 will-change-[opacity]"
            style={{ background: s.bg, opacity: i === 0 ? 1 : 0 }}
            aria-hidden
          />
        ))}
        <div
          ref={sun}
          className="absolute left-0 top-0 h-16 w-16 rounded-full opacity-70 will-change-transform sm:h-32 sm:w-32 sm:opacity-100"
          style={{
            background: "radial-gradient(circle, #fff3d6 0%, #f3c27f 45%, rgba(243,194,127,0) 72%)",
            transform: "translate3d(-8vw, 26vh, 0)",
          }}
          aria-hidden
        />
        <div
          ref={moon}
          className="absolute right-[12%] top-[14%] h-16 w-16 rounded-full opacity-0 will-change-transform"
          style={{ boxShadow: "inset -14px -6px 0 0 #f2e6d0", background: "transparent" }}
          aria-hidden
        />

        <div className="relative mx-auto grid h-full w-full max-w-6xl items-center gap-6 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_400px] lg:gap-14">
          <div className={`transition-colors duration-700 ${dark ? "text-cream" : "text-espresso"}`}>
            <p className={`eyebrow ${dark ? "!text-latte" : ""}`}>{t("l.story.eyebrow")}</p>
            <p className="mt-3 font-serif text-[clamp(4rem,16vw,9rem)] leading-none tabular-nums tracking-tight" aria-live="off">
              {hhmm(minute)}
            </p>
            <p key={step} className="animate-rise mt-5 max-w-lg text-lg leading-relaxed sm:text-xl">
              {t(`l.story.${step}` as MessageKey)}
            </p>
            {minute === START && (
              <p className="mt-8 text-sm font-semibold opacity-75">↓ {t("l.story.scroll")}</p>
            )}
          </div>

          <div className="rounded-[32px] bg-paper/92 p-3 shadow-soft ring-1 ring-black/5 sm:p-4">
            <ol className="space-y-1.5">
              {STEPS.map((s, i) => {
                const done = i < step || (i === step && i === STEPS.length - 1 && minute >= END - 5);
                const current = i === step && !done;
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2 transition-[background-color,opacity] duration-500 sm:py-2.5 ${
                      current ? "bg-latte/70" : i > step ? "opacity-45" : ""
                    }`}
                  >
                    <span className="w-11 shrink-0 text-xs font-bold tabular-nums text-mocha">{hhmm(s.at)}</span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cream text-caramel">
                      <ItemIcon name={s.icon} className="h-4 w-4" />
                    </span>
                    <span className={`flex-1 truncate text-sm font-semibold text-espresso ${done ? "line-through decoration-caramel/60" : ""}`}>
                      {t(`l.item.${i}` as MessageKey)}
                    </span>
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-300 ${
                        done ? "scale-100 bg-coffee text-cream" : "scale-90 ring-1 ring-latte"
                      }`}
                    >
                      {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

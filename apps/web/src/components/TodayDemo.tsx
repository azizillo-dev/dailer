"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";

const ITEMS: { time: string; key: MessageKey; done: boolean }[] = [
  { time: "05:00", key: "demo.wake", done: true },
  { time: "05:30", key: "demo.fajr", done: true },
  { time: "05:45", key: "demo.reading", done: true },
  { time: "08:00", key: "demo.classes", done: false },
  { time: "18:00", key: "demo.sport", done: false },
];

const DONE = 5;
const TOTAL = 9;
const R = 26;
const C = 2 * Math.PI * R;

/** Landing'dagi "Bugun" ekrani namunasi — vazifalar birin-ketin belgilanadi. */
export function TodayDemo() {
  const { t } = useI18n();
  return (
    <div className="card relative mx-auto w-full max-w-sm p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">{t("hero.today")}</p>
          <p className="mt-1 font-serif text-2xl">
            {DONE}/{TOTAL} <span className="text-base text-ink-soft">{t("hero.done")}</span>
          </p>
        </div>
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke="var(--caramel)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - DONE / TOTAL)}
            className="demo-ring"
            style={{ "--c": C } as React.CSSProperties}
          />
        </svg>
      </div>

      <ol className="mt-5 space-y-2.5">
        {ITEMS.map((item, i) => (
          <li
            key={item.key}
            className="animate-rise flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3"
            style={{ animationDelay: `${0.35 + i * 0.12}s` }}
          >
            <span className="w-11 shrink-0 text-xs font-bold tabular-nums text-ink-faint">{item.time}</span>
            <span className={`flex-1 text-sm font-semibold ${item.done ? "text-ink" : "text-ink-soft"}`}>
              {t(item.key)}
            </span>
            <span
              className={`grid h-7 w-7 place-items-center rounded-full ${
                item.done ? "bg-accent text-accent-ink" : "ring-1 ring-line"
              }`}
              aria-hidden
            >
              {item.done && (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
                  <path
                    d="M3 8.5 6.5 12 13 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="demo-check"
                    style={{ animationDelay: `${0.9 + i * 0.25}s` }}
                  />
                </svg>
              )}
            </span>
          </li>
        ))}
      </ol>

      <div className="animate-rise absolute -right-3 -top-4 rounded-full bg-espresso px-3.5 py-2 text-xs font-bold text-cream shadow-soft sm:-right-6" style={{ animationDelay: "1.6s" }}>
        ▲ +18% <span className="font-medium opacity-80">{t("hero.week")}</span>
      </div>
    </div>
  );
}

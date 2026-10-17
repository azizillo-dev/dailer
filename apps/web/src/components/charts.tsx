"use client";

import { useEffect, useRef, useState } from "react";

export type DayRow = {
  date: string;
  planned: number;
  done: number;
  partial: number;
  missed: number;
  excused: number;
  score: number | null;
};

/** Sana → qisqa hafta kuni (foydalanuvchi tilida). */
export function weekdayShort(iso: string, lang: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { weekday: "short" });
}

export function dateLong(iso: string, lang: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Bitta seriya — kunlik ball (0–100). Har bir ustunda hover tooltip. */
export function WeekBars({
  days,
  lang,
  today,
  labels,
}: {
  days: DayRow[];
  lang: string;
  today: string;
  labels: { open: string; none: string; doneOf: (d: DayRow) => string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 160;
  return (
    <div className="relative">
      <div className="relative" style={{ height: H }}>
        {/* Yengil grid: 50% va 100% */}
        {[100, 50].map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 border-t border-dashed border-line"
            style={{ top: H - (g / 100) * H }}
            aria-hidden
          >
            <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[10px] font-semibold text-ink-faint">{g}%</span>
          </div>
        ))}
        <div className="absolute inset-0 grid grid-cols-7 items-end gap-2 pr-8 sm:gap-3">
          {days.map((d, i) => {
            const h = d.score == null ? 0 : Math.max(4, (d.score / 100) * H);
            const isToday = d.date === today;
            return (
              <div
                key={d.date}
                className="relative flex h-full items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${dateLong(d.date, lang)}: ${d.score == null ? labels.none : `${Math.round(d.score)}%`}`}
              >
                {d.score == null ? (
                  <span className="mb-0 h-1 w-full max-w-9 rounded-full bg-line" />
                ) : (
                  <span
                    className={`w-full max-w-9 rounded-t-[4px] transition-[opacity,transform] duration-300 ${
                      hover !== null && hover !== i ? "opacity-50" : ""
                    } ${isToday ? "bg-highlight" : "bg-caramel"}`}
                    style={{ height: h, transformOrigin: "bottom", animation: `grow 0.7s ${i * 0.05}s var(--ease-out-soft) both` }}
                  />
                )}
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-44 rounded-xl bg-espresso px-3 py-2 text-xs text-cream shadow-soft">
                    <p className="font-bold">{dateLong(d.date, lang)}</p>
                    <p className="mt-0.5 opacity-80">
                      {d.score == null ? (d.planned ? labels.open : labels.none) : `${Math.round(d.score)}% · ${labels.doneOf(d)}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 pr-8 sm:gap-3">
        {days.map((d) => (
          <span
            key={d.date}
            className={`text-center text-[11px] font-bold uppercase ${d.date === today ? "text-highlight" : "text-ink-faint"}`}
          >
            {weekdayShort(d.date, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}

const SEQ = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)"];

export function seqColor(score: number | null) {
  if (score == null) return null;
  // 0–19 · 20–39 · 40–59 · 60–79 · 80–100
  return SEQ[Math.min(4, Math.floor(score / 20))];
}

/** Kunlar kalendari (heatmap). Rang — ball; rejasiz kun — chiziqli bo'sh katak. */
export function DayHeatmap({
  days,
  lang,
  labels,
}: {
  days: DayRow[];
  lang: string;
  labels: { none: string; open: string; low: string; high: string };
}) {
  const [hover, setHover] = useState<DayRow | null>(null);
  // Haftalar dushanbadan boshlanadi
  const first = new Date(`${days[0]?.date}T12:00:00`);
  const pad = (first.getDay() + 6) % 7;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: pad }, (_, i) => (
          <span key={`p${i}`} />
        ))}
        {days.map((d) => {
          const c = seqColor(d.score);
          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => setHover(d)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d)}
              onBlur={() => setHover(null)}
              className="aspect-square rounded-lg ring-1 ring-inset ring-line/60 transition-transform hover:scale-105"
              style={
                c
                  ? { background: c }
                  : {
                      background:
                        "repeating-linear-gradient(135deg, transparent 0 4px, var(--line) 4px 5px)",
                    }
              }
              aria-label={`${dateLong(d.date, lang)}: ${d.score == null ? (d.planned ? labels.open : labels.none) : `${Math.round(d.score)}%`}`}
            >
              <span className="sr-only">{d.date}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex min-h-5 items-center justify-between gap-3 text-xs text-ink-faint">
        <span className="truncate">
          {hover
            ? `${dateLong(hover.date, lang)} — ${hover.score == null ? (hover.planned ? labels.open : labels.none) : `${Math.round(hover.score)}%`}`
            : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          {labels.low}
          {SEQ.map((c) => (
            <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
          ))}
          {labels.high}
        </span>
      </div>
    </div>
  );
}

export type HeatDay = { date: string; score: number | null; planned: number; frozen: boolean };

/** Yillik xarita: ustun — hafta, qator — hafta kuni (Du…Ya). Mobilda gorizontal suriladi. */
export function YearHeatmap({
  days,
  lang,
  labels,
}: {
  days: HeatDay[];
  lang: string;
  labels: { none: string; frozen: string; low: string; high: string; weekdays: string[] };
}) {
  const [hover, setHover] = useState<HeatDay | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Eng so'nggi haftalar ko'rinib tursin
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
  }, [days.length]);

  if (!days.length) return null;
  const first = new Date(`${days[0].date}T12:00:00`);
  const pad = (first.getDay() + 6) % 7;
  const cells: (HeatDay | null)[] = [...Array(pad).fill(null), ...days];
  const weeks: (HeatDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const loc = lang === "uz" ? "uz-Latn" : lang;
  // Oy nomi faqat oyning 1-kuni tushgan haftada
  const monthOf = (w: (HeatDay | null)[]) => {
    const d = w.find((x) => x && x.date.endsWith("-01"));
    return d ? new Date(`${d.date}T12:00:00`).toLocaleDateString(loc, { month: "short" }) : "";
  };

  return (
    <div>
      <div ref={scroller} className="overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="inline-flex gap-[3px]">
          <div className="mr-1 grid grid-rows-[14px_repeat(7,12px)] gap-[3px] text-[9px] font-semibold text-ink-faint">
            <span />
            {labels.weekdays.map((w, i) => (
              <span key={i} className="leading-[12px]">
                {i % 2 === 0 ? w : ""}
              </span>
            ))}
          </div>
          {weeks.map((w, wi) => (
            <div key={wi} className="grid grid-rows-[14px_repeat(7,12px)] gap-[3px]">
              <span className="whitespace-nowrap text-[9px] font-semibold leading-[14px] text-ink-faint">{monthOf(w)}</span>
              {Array.from({ length: 7 }, (_, di) => {
                const d = w[di];
                if (!d) return <span key={di} className="h-3 w-3" />;
                const c = seqColor(d.score);
                return (
                  <span
                    key={di}
                    onMouseEnter={() => setHover(d)}
                    onMouseLeave={() => setHover(null)}
                    title={d.date}
                    className={`h-3 w-3 rounded-[3px] ${d.frozen ? "ring-1 ring-ink-soft ring-offset-1 ring-offset-surface" : ""}`}
                    style={{
                      background: c ?? (d.planned ? "var(--surface-2)" : "transparent"),
                      boxShadow: c ? undefined : "inset 0 0 0 1px var(--line)",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs text-ink-faint">
        <span className="truncate">
          {hover
            ? `${dateLong(hover.date, lang)} — ${hover.frozen ? labels.frozen : hover.score == null ? labels.none : `${Math.round(hover.score)}%`}`
            : ""}
        </span>
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          {labels.low}
          {SEQ.map((c) => (
            <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
          ))}
          {labels.high}
        </span>
      </div>
    </div>
  );
}

export function DeltaBadge({ delta, suffix }: { delta: number | null; suffix?: string }) {
  if (delta == null) return null;
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        flat ? "bg-surface-2 text-ink-soft" : up ? "bg-success/12 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {flat ? "=" : up ? "▲" : "▼"} {Math.abs(delta)}%{suffix ? <span className="font-medium opacity-80"> {suffix}</span> : null}
    </span>
  );
}

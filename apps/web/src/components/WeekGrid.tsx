"use client";

import { Check, Flame, Share2, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { ItemIcon } from "@/components/ItemIcon";
import { api } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { shareOrDownload } from "@/lib/share-card";
import { renderWeekCard } from "@/lib/share-week";

type CellState = "off" | "future" | "open" | "done" | "partial" | "missed" | "excused";
export type WeekGridData = {
  week_start: string;
  week_end: string;
  rows: {
    item_id: string;
    title: string;
    icon: string;
    cells: { date: string; state: CellState; progress: number | null }[];
    done: number;
    scheduled: number;
    unit: string | null;
    value: number | null;
    value_target: number | null;
    streak: number;
  }[];
  days: { date: string; score: number | null }[];
  completion: number | null;
  checkins: number;
  prev_checkins: number;
  checkins_delta_pct: number | null;
  perfect_days: number;
  best_streak: { title: string; icon: string; days: number } | null;
};

// Telefonda ikki qavat: [nom ×5 | bajarildi ×2] / [7 kun]; katta ekranda bitta qator: nom | 7 kun | bajarildi
const GRID = "grid grid-cols-7 items-center gap-x-1 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_repeat(7,2.25rem)_4.5rem] sm:gap-x-1.5 sm:gap-y-0";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Bir katak: ✓ (bajarildi), halqa (qisman / miqdor), bo'sh doira (o'tkazildi), nuqta (rejada yo'q). */
export function Cell({ state, progress }: { state: CellState; progress: number | null }) {
  if (state === "off") return <span className="mx-auto block h-1.5 w-1.5 rounded-full bg-line" aria-hidden />;
  if (state === "done")
    return (
      <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-success text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  const r = 10;
  const c = 2 * Math.PI * r;
  const p = state === "partial" || (progress != null && progress > 0) ? (progress ?? 0.5) : 0;
  const stroke = state === "open" ? "var(--highlight)" : "var(--line)";
  return (
    <svg viewBox="0 0 24 24" className={`mx-auto block h-6 w-6 ${state === "future" ? "opacity-40" : ""}`} aria-hidden>
      <circle cx="12" cy="12" r={r} fill="none" stroke={stroke} strokeWidth="2" strokeDasharray={state === "open" ? "3 3" : undefined} />
      {p > 0 && (
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 12 12)"
        />
      )}
      {state === "excused" && (
        <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--ink-faint)">
          U
        </text>
      )}
    </svg>
  );
}

const STATE_LABEL: Partial<Record<CellState, MessageKey>> = {
  done: "status.done",
  partial: "status.partial",
  missed: "status.missed",
  excused: "status.excused",
};

export function WeekGrid({ start, weekLabel }: { start: string | null; weekLabel: string }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState<WeekGridData | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    api<WeekGridData>(`/api/v1/stats/week-grid${start ? `?start=${start}` : ""}`, { auth: true })
      .then(setData)
      .catch(() => {});
  }, [start, lang]);

  if (!data) return <div className="card mt-3 h-64 animate-pulse" />;
  const locale = lang === "uz" ? "uz-Latn" : lang;
  const dayNames = data.days.map((_, i) => t(`day.${i}` as MessageKey));
  const delta = data.checkins_delta_pct;

  async function share() {
    if (!data) return;
    setSharing(true);
    try {
      const blob = await renderWeekCard(data, {
        title: t("share.title"),
        range: weekLabel,
        dayNames,
        labels: {
          completion: t("grid.completion"),
          checkins: t("grid.checkins"),
          bestStreak: t("grid.bestStreak"),
          perfect: t("grid.perfect"),
          habit: t("grid.habit"),
          done: t("grid.done"),
          days: t("grid.days"),
          delta: delta == null ? "" : t(delta >= 0 ? "grid.ahead" : "grid.behind", { n: Math.abs(delta) }),
          vs: t("grid.vs", { now: fmt(data.checkins), prev: fmt(data.prev_checkins) }),
          made: t("grid.made"),
        },
      });
      await shareOrDownload(blob, `dailer-hafta-${data.week_start}.png`, `${t("share.title")} · Dailer`);
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className="card animate-rise mt-3 p-4 sm:p-6" style={{ animationDelay: "0.08s" }} aria-labelledby="grid-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="grid-title" className="font-serif text-xl">
          {t("grid.title")}
        </h2>
        {data.rows.length > 0 && (
          <button onClick={share} disabled={sharing} className="btn-ghost h-9 gap-1.5 px-3.5 text-xs disabled:opacity-50">
            <Share2 className="h-3.5 w-3.5" /> {t("grid.share")}
          </button>
        )}
      </div>

      {data.rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{t("grid.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto" role="table" aria-label={t("grid.title")}>
          <div>
            {/* Kunlar ustuni qat'iy kenglikda — qolgan joy vazifa nomiga */}
            <div role="row" className={`${GRID} pb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint`}>
              <span role="columnheader" className="hidden sm:block">
                {t("grid.habit")}
              </span>
              {dayNames.map((d, i) => (
                <span key={i} role="columnheader" className="text-center">
                  {d.slice(0, 2)}
                </span>
              ))}
              <span role="columnheader" className="hidden text-right sm:order-last sm:block">
                {t("grid.done")}
              </span>
            </div>
            {data.rows.map((r) => {
              const measured = r.value_target != null;
              const complete = measured ? (r.value ?? 0) >= (r.value_target ?? 0) : r.done >= r.scheduled && r.scheduled > 0;
              return (
                <div key={r.item_id} role="row" className={`${GRID} border-t border-line py-2.5 sm:py-2`}>
                  <span role="cell" className="col-span-5 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-highlight">
                      <ItemIcon name={r.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold" title={r.title}>
                      {r.title}
                    </span>
                    {r.streak >= 3 && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-highlight" title={t("grid.bestStreak")}>
                        <Flame className="h-3 w-3" />
                        {r.streak}
                      </span>
                    )}
                  </span>
                  <span role="cell" className={`col-span-2 whitespace-nowrap text-right text-sm font-bold tabular-nums sm:order-last sm:col-span-1 ${complete ? "text-success" : ""}`}>
                    {measured ? (
                      <span className="inline-flex flex-col items-end leading-tight">
                        <span>
                          {fmt(r.value ?? 0)}/{fmt(r.value_target ?? 0)}
                        </span>
                        <span className="text-[10px] font-semibold text-ink-faint">{r.unit}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {r.done}/{r.scheduled}
                        {complete && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    )}
                  </span>
                  {r.cells.map((c) => (
                    <span
                      key={c.date}
                      role="cell"
                      className="text-center"
                      title={`${new Date(`${c.date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })}${STATE_LABEL[c.state] ? ` · ${t(STATE_LABEL[c.state]!)}` : ""}`}
                    >
                      <Cell state={c.state} progress={c.progress} />
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Xulosa */}
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
        <Stat value={data.completion == null ? "–" : `${Math.round(data.completion)}%`} label={t("grid.completion")} accent="text-success" />
        <Stat value={fmt(data.checkins)} label={t("grid.checkins")} />
        <Stat
          value={data.best_streak ? `${data.best_streak.days} ${t("grid.days")}` : "–"}
          label={data.best_streak ? `${t("grid.bestStreak")} · ${data.best_streak.title}` : t("grid.bestStreak")}
          accent="text-highlight"
        />
        <Stat value={String(data.perfect_days)} label={t("grid.perfect")} />
      </div>
      {delta != null && (
        <p className={`mt-3 flex flex-wrap items-center gap-x-2 text-xs font-semibold ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {t(delta >= 0 ? "grid.ahead" : "grid.behind", { n: Math.abs(delta) })}
          <span className="font-medium text-ink-faint">· {t("grid.vs", { now: fmt(data.checkins), prev: fmt(data.prev_checkins) })}</span>
        </p>
      )}
      <p className="mt-2 text-[11px] text-ink-faint">{t("grid.legend")}</p>
    </section>
  );
}

function Stat({ value, label, accent = "" }: { value: string; label: string; accent?: string }) {
  return (
    <div className="min-w-0">
      <p className={`font-serif text-3xl leading-none tracking-tight ${accent}`}>{value}</p>
      <p className="mt-1.5 truncate text-xs text-ink-soft">{label}</p>
    </div>
  );
}

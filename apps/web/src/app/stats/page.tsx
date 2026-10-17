"use client";

import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { DeltaBadge, WeekBars, YearHeatmap, dateLong, type DayRow, type HeatDay } from "@/components/charts";
import { ItemIcon } from "@/components/ItemIcon";
import { ProgressRing } from "@/components/ProgressRing";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localISODate, type Category } from "@/lib/types";

type Weekly = {
  week_start: string;
  week_end: string;
  is_current: boolean;
  days: DayRow[];
  total: DayRow & { score: number | null };
  prev_score: number | null;
  delta: number | null;
  categories: (Omit<DayRow, "date"> & { category: Category; prev_score: number | null; delta: number | null })[];
  best_day: string | null;
  weak_day: string | null;
  streak: { current: number; longest: number; threshold: number };
};

const CAT_ICON: Record<Category, string> = {
  prayer: "moon", reading: "book", sport: "dumbbell", study: "graduation", language: "languages",
  quran: "book-open", dhikr: "sparkle", sleep: "bed", health: "heart", work: "briefcase", custom: "list",
};

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localISODate(d);
}

function StatsView() {
  const { t, lang } = useI18n();
  const today = useMemo(() => localISODate(), []);
  const [start, setStart] = useState<string | null>(null);
  const [data, setData] = useState<Weekly | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (s: string | null) => {
      try {
        setData(await api<Weekly>(`/api/v1/stats/weekly${s ? `?start=${s}` : ""}`, { auth: true }));
      } catch (err) {
        setError(errorText(err, t));
      }
    },
    [t],
  );

  useEffect(() => {
    load(start);
  }, [start, load]);

  const [freeze, setFreeze] = useState<{ left: number } | null>(null);
  const [candidates, setCandidates] = useState<{ date: string }[]>([]);
  const [freezeMsg, setFreezeMsg] = useState("");
  const [insights, setInsights] = useState<{ kind: string; text: string }[]>([]);
  const [heat, setHeat] = useState<{ year: number; days: HeatDay[]; active_days: number; perfect_days: number; avg_score: number | null } | null>(null);
  useEffect(() => {
    api<{ left: number }>("/api/v1/streak/freezes", { auth: true }).then(setFreeze).catch(() => {});
    api<{ date: string }[]>("/api/v1/stats/freeze-candidates", { auth: true }).then(setCandidates).catch(() => {});
    api<{ kind: string; text: string }[]>("/api/v1/stats/insights", { auth: true }).then(setInsights).catch(() => {});
    api<typeof heat>("/api/v1/stats/heatmap", { auth: true }).then(setHeat).catch(() => {});
  }, [lang]);

  const range = data
    ? `${new Date(`${data.week_start}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { day: "numeric", month: "short" })} – ${new Date(`${data.week_end}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { day: "numeric", month: "short" })}`
    : "";
  const score = data?.total.score;

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{data?.is_current ? t("stats.thisWeek") : range}</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">{t("stats.title")}</h1>
        </div>
        <div className="flex gap-1.5">
          <button
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line"
            onClick={() => data && setStart(shift(data.week_start, -7))}
            aria-label="←"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line disabled:opacity-30"
            onClick={() => data && setStart(shift(data.week_start, 7))}
            disabled={!data || data.is_current}
            aria-label="→"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      {data && (
        <>
          {/* Asosiy raqamlar */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="card animate-rise p-6">
              <p className="text-sm font-semibold text-ink-soft">{t("stats.score")}</p>
              <p className="mt-2 font-serif text-6xl leading-none tracking-tight">
                {score == null ? "–" : Math.round(score)}
                {score != null && <span className="text-3xl text-ink-faint">%</span>}
              </p>
              <div className="mt-3">
                {data.delta != null ? (
                  <DeltaBadge delta={data.delta} suffix={t("stats.vsLast")} />
                ) : (
                  <span className="text-xs text-ink-faint">{t("stats.noPrev")}</span>
                )}
              </div>
            </div>
            <div className="card animate-rise p-6" style={{ animationDelay: "0.05s" }}>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                <Flame className="h-4 w-4 text-highlight" /> {t("stats.streak")}
              </p>
              <p className="mt-2 font-serif text-6xl leading-none tracking-tight">{data.streak.current}</p>
              <p className="mt-3 text-xs text-ink-faint">
                {t("stats.longest", { n: data.streak.longest })} · {t("stats.threshold")}
              </p>
              {freeze && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-xs font-semibold text-ink-soft">
                    ❄ {t("freeze.title")} · {t("freeze.left", { n: freeze.left })}
                  </p>
                  {freezeMsg ? (
                    <p className="mt-2 text-xs font-bold text-success">✓ {freezeMsg}</p>
                  ) : freeze.left > 0 && candidates.length > 0 ? (
                    <button
                      className="btn-ghost mt-2 h-9 px-4 text-xs"
                      onClick={async () => {
                        const r = await api<{ streak: Weekly["streak"]; left: number }>("/api/v1/streak/freezes", {
                          method: "POST",
                          auth: true,
                          body: { date: candidates[0].date },
                        }).catch(() => null);
                        if (r) {
                          setFreeze({ ...freeze, left: r.left });
                          setCandidates(candidates.slice(1));
                          setData((d) => (d ? { ...d, streak: r.streak } : d));
                          setFreezeMsg(t("freeze.done"));
                        }
                      }}
                    >
                      {t("freeze.use", { day: dateLong(candidates[0].date, lang) })}
                    </button>
                  ) : (
                    <p className="mt-1 text-[11px] text-ink-faint">{t("freeze.hint")}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Kunlar bo'yicha */}
          <section className="card animate-rise mt-3 p-5 sm:p-6" style={{ animationDelay: "0.1s" }}>
            <h2 className="font-serif text-xl">{t("stats.byDay")}</h2>
            <div className="mt-8">
              <WeekBars
                days={data.days}
                lang={lang}
                today={today}
                labels={{
                  open: t("stats.open"),
                  none: t("stats.noData"),
                  doneOf: (d) => t("today.of", { done: d.done, total: d.planned }),
                }}
              />
            </div>
            {(data.best_day || data.weak_day) && (
              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                {data.best_day && (
                  <p className="rounded-2xl bg-surface-2 px-4 py-3">
                    <span className="text-ink-faint">{t("stats.best")}: </span>
                    <span className="font-semibold">{dateLong(data.best_day, lang)}</span>
                  </p>
                )}
                {data.weak_day && (
                  <p className="rounded-2xl bg-surface-2 px-4 py-3">
                    <span className="text-ink-faint">{t("stats.weak")}: </span>
                    <span className="font-semibold">{dateLong(data.weak_day, lang)}</span>
                  </p>
                )}
              </div>
            )}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-ink-soft">{t("stats.table")}</summary>
              <table className="mt-3 w-full text-left tabular-nums">
                <thead className="text-xs text-ink-faint">
                  <tr>
                    <th className="py-1.5 font-semibold">{t("stats.date")}</th>
                    <th className="font-semibold">%</th>
                    <th className="font-semibold">{t("status.done")}</th>
                    <th className="font-semibold">{t("status.partial")}</th>
                    <th className="font-semibold">{t("status.missed")}</th>
                    <th className="font-semibold">{t("status.excused")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => (
                    <tr key={d.date} className="border-t border-line">
                      <td className="py-1.5">{dateLong(d.date, lang)}</td>
                      <td>{d.score == null ? "–" : Math.round(d.score)}</td>
                      <td>{d.done}</td>
                      <td>{d.partial}</td>
                      <td>{d.missed}</td>
                      <td>{d.excused}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </section>

          {/* Bilasizmi? */}
          <section className="mt-8">
            <h2 className="font-serif text-xl">{t("ins.title")}</h2>
            {insights.length === 0 ? (
              <p className="card mt-3 p-5 text-sm text-ink-soft">{t("ins.empty")}</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {insights.map((i) => (
                  <p key={i.kind} className="card animate-rise flex gap-3 p-5 text-[15px] leading-relaxed">
                    <span className="text-xl" aria-hidden>
                      {{ sleep: "🌙", mood: "🙂", weekday: "📅", morning: "🌅", focus: "⏱" }[i.kind] ?? "💡"}
                    </span>
                    <span>{i.text}</span>
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* Yo'nalishlar */}
          <h2 className="mt-8 font-serif text-xl">{t("stats.byCategory")}</h2>
          {data.categories.length === 0 && <p className="card mt-3 p-6 text-ink-soft">{t("stats.empty")}</p>}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.categories.map((c, i) => (
              <Link
                key={c.category}
                href={`/stats/${c.category}`}
                className="card animate-rise flex flex-col items-center p-5 text-center transition-transform hover:-translate-y-0.5"
                style={{ animationDelay: `${0.12 + i * 0.04}s` }}
              >
                <ProgressRing value={(c.score ?? 0) / 100} size={84} stroke={8}>
                  <span className="text-highlight">
                    <ItemIcon name={CAT_ICON[c.category]} className="h-6 w-6" />
                  </span>
                </ProgressRing>
                <p className="mt-3 text-sm font-semibold">{t(`cat.${c.category}` as MessageKey)}</p>
                <p className="font-serif text-2xl">{c.score == null ? "–" : `${Math.round(c.score)}%`}</p>
                <p className="text-xs text-ink-faint">{t("today.of", { done: c.done, total: c.planned })}</p>
                <div className="mt-2 min-h-5">
                  <DeltaBadge delta={c.delta} />
                </div>
              </Link>
            ))}
          </div>

          {/* Yil xaritasi */}
          {heat && heat.days.length > 0 && (
            <section className="card mt-8 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-xl">
                  {t("heat.title")} · {heat.year}
                </h2>
                <p className="text-xs text-ink-faint">
                  {t("heat.active", { n: heat.active_days })} · {t("heat.perfect", { n: heat.perfect_days })}
                  {heat.avg_score != null ? ` · ${t("heat.avg", { n: Math.round(heat.avg_score) })}` : ""}
                </p>
              </div>
              <div className="mt-4">
                <YearHeatmap
                  days={heat.days}
                  lang={lang}
                  labels={{
                    none: t("stats.noData"),
                    frozen: t("heat.frozen"),
                    low: t("stats.legendLow"),
                    high: t("stats.legendHigh"),
                    weekdays: Array.from({ length: 7 }, (_, i) => t(`day.${i}` as MessageKey)),
                  }}
                />
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

export default function StatsPage() {
  return (
    <AppShell>
      <StatsView />
    </AppShell>
  );
}

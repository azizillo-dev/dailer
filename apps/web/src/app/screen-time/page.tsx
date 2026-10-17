"use client";

import { ChevronLeft, ChevronRight, Lightbulb, Smartphone, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { localISODate } from "@/lib/types";

type Period = "week" | "month";
type Summary = {
  period: Period;
  start: string;
  end: string;
  days: { date: string; total_min: number | null; pickups: number | null; source: string | null; future: boolean }[];
  total_min: number;
  avg_min: number | null;
  delta_pct: number | null;
  avg_pickups: number | null;
  top_apps: { id: string; name: string; minutes: number }[];
  limit_min: number | null;
  days_over_limit: number;
  insight: { threshold_min: number; low_score: number; high_score: number } | null;
};

const LIMITS = [60, 120, 180, 240];

function ScreenTimeView() {
  const { t, lang } = useI18n();
  const locale = lang === "uz" ? "uz-Latn" : lang;
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Summary | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const fmt = useCallback(
    (min: number | null | undefined) => {
      if (min == null) return "–";
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      if (!h) return `${m} ${t("st.m")}`;
      return m ? `${h} ${t("st.h")} ${m} ${t("st.m")}` : `${h} ${t("st.h")}`;
    },
    [t],
  );

  const load = useCallback(async () => {
    try {
      setData(await api<Summary>(`/api/v1/screen-time?period=${period}&offset=${offset}`, { auth: true }));
    } catch {}
  }, [period, offset]);
  useEffect(() => {
    load();
  }, [load]);

  async function setLimit(v: number | null) {
    await api("/api/v1/screen-time/limit", { method: "PUT", auth: true, body: { limit_min: v } }).catch(() => {});
    load();
  }

  const max = Math.max(60, data?.limit_min ?? 0, ...(data?.days.map((d) => d.total_min ?? 0) ?? []));
  const shown = data?.days.find((d) => d.date === hover);
  const label = data
    ? period === "week"
      ? `${new Date(`${data.start}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${new Date(`${data.end}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}`
      : new Date(`${data.start}T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" })
    : "";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow capitalize">{label}</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">{t("st.title")}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full bg-surface-2 p-1" role="tablist">
            {(["week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={period === p}
                onClick={() => {
                  setPeriod(p);
                  setOffset(0);
                }}
                className={`h-8 rounded-full px-4 text-sm font-bold transition-colors ${period === p ? "bg-accent text-accent-ink" : "text-ink-soft"}`}
              >
                {t(p === "week" ? "st.week" : "st.month")}
              </button>
            ))}
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line" onClick={() => setOffset((o) => Math.max(-24, o - 1))} aria-label="←">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line disabled:opacity-30" disabled={offset >= 0} onClick={() => setOffset((o) => Math.min(0, o + 1))} aria-label="→">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <div className="card animate-rise p-6">
              <p className="text-sm font-semibold text-ink-soft">{t("st.avg")}</p>
              <p className="mt-2 font-serif text-4xl leading-tight tracking-tight sm:text-[2.6rem]">{fmt(data.avg_min)}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                {data.delta_pct != null && data.delta_pct !== 0 && (
                  <span className={`inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 ${data.delta_pct < 0 ? "text-success" : "text-danger"}`}>
                    {data.delta_pct < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                    {t(data.delta_pct < 0 ? "st.less" : "st.more", { n: Math.abs(data.delta_pct) })} · {t("st.vsPrev")}
                  </span>
                )}
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-soft">
                  {t("st.total")}: {fmt(data.total_min)}
                </span>
                {data.avg_pickups != null && (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-soft">
                    {data.avg_pickups} {t("st.pickups")}
                  </span>
                )}
              </div>
            </div>

            {/* Kunlar grafigi */}
            <div className="card animate-rise p-5" style={{ animationDelay: "0.05s" }}>
              <div className="relative flex h-40 items-end gap-1 sm:gap-2" onMouseLeave={() => setHover(null)}>
                {data.limit_min != null && (
                  <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-danger/60" style={{ bottom: `${(data.limit_min / max) * 100}%` }} />
                )}
                {data.days.map((d) => {
                  const over = data.limit_min != null && (d.total_min ?? 0) > data.limit_min;
                  return (
                    <button
                      key={d.date}
                      className="flex h-full flex-1 items-end justify-center"
                      onMouseEnter={() => setHover(d.date)}
                      onFocus={() => setHover(d.date)}
                      disabled={d.future}
                      aria-label={`${d.date}: ${fmt(d.total_min)}`}
                    >
                      <span
                        className={`block w-full max-w-8 rounded-t-md transition-[height,opacity] duration-500 ${d.total_min == null ? "bg-line" : over ? "bg-danger" : "bg-caramel"} ${hover && hover !== d.date ? "opacity-50" : ""}`}
                        style={{ height: d.total_min == null ? 3 : `${Math.max(3, (d.total_min / max) * 100)}%` }}
                      />
                    </button>
                  );
                })}
              </div>
              {period === "week" && (
                <div className="mt-2 flex gap-1 sm:gap-2">
                  {data.days.map((d) => (
                    <span key={d.date} className="flex-1 text-center text-[11px] font-bold capitalize text-ink-faint">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 min-h-5 text-center text-xs text-ink-faint">
                {shown
                  ? `${new Date(`${shown.date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}: ${fmt(shown.total_min)}${shown.source === "android" ? ` · ${t("st.android")}` : ""}`
                  : data.days_over_limit > 0
                    ? t("st.overLimit", { n: data.days_over_limit })
                    : data.avg_min == null
                      ? t("st.empty")
                      : ""}
              </p>
            </div>
          </div>

          {data.insight && (
            <p className="mt-3 flex gap-3 rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-highlight" />
              {t("st.insight", { t: fmt(data.insight.threshold_min), low: data.insight.low_score, high: data.insight.high_score })}
            </p>
          )}

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ManualEntry onSaved={load} />

            <section>
              <h2 className="font-serif text-xl">{t("st.topApps")}</h2>
              {data.top_apps.length === 0 ? (
                <p className="card mt-3 flex items-center gap-3 p-5 text-sm text-ink-soft">
                  <Smartphone className="h-5 w-5 shrink-0 text-highlight" /> {t("st.empty")}
                </p>
              ) : (
                <ul className="card mt-3 divide-y divide-line">
                  {data.top_apps.map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{a.name}</span>
                        <span className="shrink-0 text-ink-faint">{fmt(a.minutes)}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-caramel" style={{ width: `${(a.minutes / data.top_apps[0].minutes) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="mt-6 font-serif text-xl">{t("st.limit")}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {[null, ...LIMITS].map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setLimit(v)}
                    className={`h-9 rounded-full px-4 text-sm font-bold ring-1 transition-colors ${data.limit_min === v ? "bg-accent text-accent-ink ring-accent" : "text-ink-soft ring-line hover:text-ink"}`}
                  >
                    {v == null ? t("st.limitOff") : fmt(v)}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function ManualEntry({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const today = useMemo(() => localISODate(), []);
  const [day, setDay] = useState(today);
  const [h, setH] = useState(2);
  const [m, setM] = useState(0);
  const [saved, setSaved] = useState(false);
  const min = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localISODate(d);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/v1/screen-time/days", { method: "PUT", auth: true, body: { source: "manual", days: [{ date: day, total_min: h * 60 + m }] } }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved();
  }

  return (
    <form className="card self-start p-5 sm:p-6" onSubmit={save}>
      <h2 className="font-serif text-xl">{t("st.manualTitle")}</h2>
      <div className="mt-4 grid grid-cols-[1.7fr_1fr_1fr] gap-3">
        <label className="text-xs font-semibold text-ink-soft">
          {t("st.day")}
          <input type="date" className="field mt-1.5" value={day} min={min} max={today} onChange={(e) => setDay(e.target.value)} required />
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          {t("st.h")}
          <input type="number" className="field mt-1.5" min={0} max={23} value={h} onChange={(e) => setH(Math.max(0, Math.min(23, Number(e.target.value))))} />
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          {t("st.m")}
          <input type="number" className="field mt-1.5" min={0} max={59} step={5} value={m} onChange={(e) => setM(Math.max(0, Math.min(59, Number(e.target.value))))} />
        </label>
      </div>
      <button className="btn-primary mt-4 h-11 w-full">{saved ? t("st.saved") : t("common.save")}</button>
      <p className="mt-3 text-xs leading-relaxed text-ink-faint">{t("st.manualHint")}</p>
    </form>
  );
}

export default function Page() {
  return (
    <AppShell>
      <ScreenTimeView />
    </AppShell>
  );
}

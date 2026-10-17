"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { DayHeatmap, DeltaBadge, type DayRow } from "@/components/charts";
import { ItemIcon } from "@/components/ItemIcon";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";

type CategoryStats = {
  category: string;
  from: string;
  to: string;
  days: DayRow[];
  total: Omit<DayRow, "date">;
  prev_score: number | null;
  delta: number | null;
  items: (Omit<DayRow, "date"> & { item_id: string; title: string; icon: string })[];
};

function CategoryView() {
  const { t, lang } = useI18n();
  const { category } = useParams<{ category: string }>();
  const [data, setData] = useState<CategoryStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CategoryStats>(`/api/v1/stats/category/${category}`, { auth: true })
      .then(setData)
      .catch((err) => setError(errorText(err, t)));
  }, [category, t]);

  return (
    <>
      <Link href="/stats" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t("stats.title")}
      </Link>
      <h1 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">{t(`cat.${category}` as MessageKey)}</h1>
      <p className="mt-1 text-ink-soft">{t("stats.last28")}</p>

      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      {data && (
        <>
          <div className="card animate-rise mt-6 flex flex-wrap items-end justify-between gap-4 p-6">
            <div>
              <p className="font-serif text-6xl leading-none">
                {data.total.score == null ? "–" : Math.round(data.total.score)}
                {data.total.score != null && <span className="text-3xl text-ink-faint">%</span>}
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                {t("today.of", { done: data.total.done, total: data.total.planned })}
              </p>
            </div>
            <DeltaBadge delta={data.delta} />
          </div>

          <section className="card animate-rise mt-3 p-5 sm:p-6" style={{ animationDelay: "0.06s" }}>
            <div className="mx-auto max-w-sm">
            <div className="mb-3 grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase text-ink-faint">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>{t(`day.${i}` as MessageKey)}</span>
              ))}
            </div>
            <DayHeatmap
              days={data.days}
              lang={lang}
              labels={{
                none: t("stats.noData"),
                open: t("stats.open"),
                low: t("stats.legendLow"),
                high: t("stats.legendHigh"),
              }}
            />
            </div>
          </section>

          <h2 className="mt-8 font-serif text-xl">{t("stats.items")}</h2>
          <ul className="mt-3 space-y-2">
            {data.items.map((it) => (
              <li key={it.item_id} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-highlight">
                  <ItemIcon name={it.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{it.title}</p>
                    <p className="shrink-0 text-sm font-bold tabular-nums">
                      {it.score == null ? "–" : `${Math.round(it.score)}%`}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full origin-left rounded-full bg-caramel"
                      style={{ transform: `scaleX(${(it.score ?? 0) / 100})`, transition: "transform .6s var(--ease-out-soft)" }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {t("status.done")}: {it.done} · {t("status.partial")}: {it.partial} · {t("status.missed")}: {it.missed}
                    {it.excused ? ` · ${t("status.excused")}: ${it.excused}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function CategoryStatsPage() {
  return (
    <AppShell>
      <CategoryView />
    </AppShell>
  );
}

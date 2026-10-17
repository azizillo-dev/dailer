"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BannerCarousel } from "@/components/BannerCarousel";
import { MotivationCard, type Motivation } from "@/components/MotivationCard";
import { api } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";

const CATS = ["all", "discipline", "time", "study", "faith", "sport", "general"] as const;
type Cat = (typeof CATS)[number];
type Item = Motivation & { created_at: string };

function MotivationsView() {
  const { t } = useI18n();
  const [today, setToday] = useState<Motivation | null>(null);
  const [cat, setCat] = useState<Cat>("all");
  const [items, setItems] = useState<Item[] | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    api<Motivation | null>("/api/v1/motivations/today", { auth: true }).then(setToday).catch(() => {});
  }, []);

  const load = useCallback(async (c: Cat, before?: string) => {
    const params = new URLSearchParams({ limit: "20" });
    if (c !== "all") params.set("category", c);
    if (before) params.set("before", before);
    const page = await api<Item[]>(`/api/v1/motivations?${params}`, { auth: true });
    setItems((prev) => (before && prev ? [...prev, ...page] : page));
    setHasMore(page.length === 20);
  }, []);

  useEffect(() => {
    setItems(null);
    load(cat).catch(() => setItems([]));
  }, [cat, load]);

  return (
    <>
      <h1 className="animate-rise font-serif text-3xl tracking-tight sm:text-4xl">{t("mot.title")}</h1>

      <div className="mt-6">
        <BannerCarousel placement="motivations" />
      </div>

      {today && (
        <section className="animate-rise mt-6">
          <p className="eyebrow mb-3">{t("mot.today")}</p>
          <MotivationCard m={today} large />
        </section>
      )}

      <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
              cat === c ? "bg-accent text-accent-ink ring-accent" : "ring-line hover:bg-surface-2"
            }`}
          >
            {t(`mot.cat.${c}` as MessageKey)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items?.map((m, i) => (
          <div key={m.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 0.04}s` }}>
            <MotivationCard m={m} />
          </div>
        ))}
      </div>
      {items && items.length === 0 && <p className="card mt-4 p-8 text-center text-ink-soft">{t("mot.empty")}</p>}
      {hasMore && items && (
        <button className="btn-ghost mt-6 w-full" onClick={() => load(cat, items[items.length - 1].created_at)}>
          {t("mot.more")}
        </button>
      )}
    </>
  );
}

export default function MotivationsPage() {
  return (
    <AppShell>
      <MotivationsView />
    </AppShell>
  );
}

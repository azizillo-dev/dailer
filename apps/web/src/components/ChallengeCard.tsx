"use client";

import Link from "next/link";
import { useState } from "react";
import { ItemIcon } from "./ItemIcon";
import { ProgressRing } from "./ProgressRing";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { localISODate } from "@/lib/types";

export type ChallengeSummary = {
  id: string;
  kind: "language_words" | "reading_pages" | "custom";
  title: string;
  description?: string | null;
  language_code: string | null;
  target_value: number;
  unit: string;
  duration_days: number;
  is_public: boolean;
  starts_on: string | null;
  ends_on: string | null;
  participants: number | null;
  joined: boolean;
  progress: number;
  day: number | null;
  expected: number | null;
  completed: boolean;
  finished: boolean;
  show_on_profile: boolean | null;
  logs?: { date: string; value: number; note: string | null }[];
};

export const KIND_ICON = { language_words: "languages", reading_pages: "book", custom: "target" } as const;

export function paceText(c: ChallengeSummary, t: (k: "ch.pace.done" | "ch.pace.ahead" | "ch.pace.behind", v?: Record<string, string | number>) => string) {
  if (c.completed) return t("ch.pace.done");
  if (c.expected == null) return "";
  if (c.progress >= c.expected) return t("ch.pace.ahead");
  const daysLeft = Math.max(1, c.duration_days - (c.day ?? 1) + 1);
  const need = Math.ceil((c.target_value - c.progress) / daysLeft);
  return t("ch.pace.behind", { n: need, unit: c.unit });
}

/** Kartochka + bugungi natijani tez kiritish. */
export function ChallengeCard({
  c,
  onChange,
  compact = false,
  hideTitle = false,
}: {
  c: ChallengeSummary;
  onChange?: (c: ChallengeSummary) => void;
  compact?: boolean;
  hideTitle?: boolean;
}) {
  const { t } = useI18n();
  const today = localISODate();
  const todayLog = c.logs?.find((l) => l.date === today);
  const [value, setValue] = useState(todayLog ? String(todayLog.value) : "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (value === "") return;
    setBusy(true);
    try {
      const next = await api<ChallengeSummary>(`/api/v1/challenges/${c.id}/logs`, {
        method: "PUT",
        auth: true,
        body: { date: today, value: Number(value) },
      });
      onChange?.(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setBusy(false);
    }
  }

  const ratio = Math.min(1, c.progress / c.target_value);
  const canLog = c.joined && !c.finished;

  return (
    <div className="card p-5">
      <Link href={`/challenges/${c.id}`} className="flex items-center gap-4">
        <ProgressRing value={ratio} size={compact ? 60 : 72} stroke={compact ? 6 : 7}>
          <span className="text-highlight">
            <ItemIcon name={KIND_ICON[c.kind]} className="h-5 w-5" />
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          {!hideTitle && <p className="truncate font-semibold">{c.title}</p>}
          <p className="mt-0.5 font-serif text-xl">{t("ch.ofTarget", { v: c.progress, t: c.target_value, unit: c.unit })}</p>
          <p className="truncate text-xs text-ink-faint">
            {c.finished ? t("ch.finished") : c.day ? t("ch.day", { day: c.day, total: c.duration_days }) : ""}
            {c.is_public && c.participants != null ? ` · ${t("ch.participants", { n: c.participants })}` : ""}
          </p>
        </div>
      </Link>
      {canLog && !compact && <p className="mt-3 text-xs font-semibold text-highlight">{paceText(c, t)}</p>}
      {canLog && (
        <div className="mt-4 flex gap-2">
          <input
            className="field h-11 flex-1"
            inputMode="numeric"
            placeholder={`${t("ch.today")} (${c.unit})`}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <button className="btn-primary h-11 px-5 text-sm" onClick={save} disabled={busy || value === ""}>
            {saved ? "✓" : t("ch.save")}
          </button>
        </div>
      )}
    </div>
  );
}

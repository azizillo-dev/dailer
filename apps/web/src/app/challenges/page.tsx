"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { ChallengeCard, KIND_ICON, type ChallengeSummary } from "@/components/ChallengeCard";
import { ItemIcon } from "@/components/ItemIcon";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";

type Kind = ChallengeSummary["kind"];
const LANGS = ["en", "ru", "de", "ar", "ko", "tr", "other"] as const;
const PRESETS: { kind: Kind; target: number; days: number }[] = [
  { kind: "language_words", target: 300, days: 10 },
  { kind: "language_words", target: 1000, days: 30 },
  { kind: "reading_pages", target: 300, days: 15 },
];

function ChallengesView() {
  const { t } = useI18n();
  const [mine, setMine] = useState<ChallengeSummary[] | null>(null);
  const [pub, setPub] = useState<ChallengeSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ kind: "language_words" as Kind, title: "", language_code: "en", target: "300", days: "10", unit: "" });

  const load = useCallback(async () => {
    const [m, p] = await Promise.all([
      api<ChallengeSummary[]>("/api/v1/challenges", { auth: true }),
      api<ChallengeSummary[]>("/api/v1/challenges?scope=public", { auth: true }),
    ]);
    // Bugungi kiritilgan qiymatni ko'rsatish uchun faollar tafsiloti (loglar bilan)
    const detailed = await Promise.all(
      m.filter((c) => !c.finished).map((c) => api<ChallengeSummary>(`/api/v1/challenges/${c.id}`, { auth: true })),
    );
    const byId = new Map(detailed.map((d) => [d.id, d]));
    setMine(m.map((c) => byId.get(c.id) ?? c));
    setPub(p);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/v1/challenges", {
        method: "POST",
        auth: true,
        body: {
          kind: form.kind,
          title: form.title.trim() || t("ch.namePh"),
          language_code: form.kind === "language_words" ? form.language_code : null,
          target_value: Number(form.target),
          duration_days: Number(form.days),
          unit: form.kind === "custom" ? form.unit.trim() || null : null,
        },
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  async function join(c: ChallengeSummary) {
    await api(`/api/v1/challenges/${c.id}/join`, { method: "POST", auth: true });
    await load();
  }

  const replace = (next: ChallengeSummary) => setMine((m) => m?.map((c) => (c.id === next.id ? next : c)) ?? null);
  const active = mine?.filter((c) => !c.finished) ?? [];
  const finished = mine?.filter((c) => c.finished) ?? [];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{t("ch.title")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t("ch.subtitle")}</p>
        </div>
        <button className="btn-primary h-11 shrink-0 px-4 text-sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("ch.new")}
        </button>
      </div>
      {error && !open && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      <h2 className="mt-8 font-serif text-xl">{t("ch.mine")}</h2>
      {mine && active.length === 0 && <p className="card mt-3 p-6 text-center text-ink-soft">{t("ch.empty")}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {active.map((c, i) => (
          <div key={c.id} className="animate-rise" style={{ animationDelay: `${i * 0.05}s` }}>
            <ChallengeCard c={c} onChange={replace} />
          </div>
        ))}
      </div>

      {pub.length > 0 && (
        <>
          <h2 className="mt-10 font-serif text-xl">{t("ch.public")}</h2>
          <ul className="mt-3 space-y-2">
            {pub.map((c) => (
              <li key={c.id} className="card flex items-center gap-4 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-highlight">
                  <ItemIcon name={KIND_ICON[c.kind]} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.title}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {t("ch.preset", { t: c.target_value, unit: c.unit, d: c.duration_days })} · {t("ch.participants", { n: c.participants ?? 0 })}
                  </p>
                </div>
                {c.joined ? (
                  <span className="shrink-0 text-xs font-bold text-success">✓ {t("ch.joined")}</span>
                ) : (
                  <button className="btn-ghost h-9 shrink-0 px-4 text-sm" onClick={() => join(c)}>
                    {t("ch.join")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {finished.length > 0 && (
        <>
          <h2 className="mt-10 font-serif text-xl text-ink-soft">{t("ch.finished")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {finished.map((c) => (
              <ChallengeCard key={c.id} c={c} compact />
            ))}
          </div>
        </>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={t("ch.new")}>
        <form onSubmit={create} className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                className="rounded-full px-3.5 py-2 text-xs font-bold ring-1 ring-line hover:bg-surface-2"
                onClick={() => setForm({ ...form, kind: p.kind, target: String(p.target), days: String(p.days) })}
              >
                {t("ch.preset", { t: p.target, unit: t(p.kind === "reading_pages" ? "ch.unit.pages" : "ch.unit.words"), d: p.days })}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t("ch.kind")}>
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ch.kind")}</span>
            <div className="grid grid-cols-3 gap-2">
              {(["language_words", "reading_pages", "custom"] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={form.kind === k}
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-bold ring-1 ${
                    form.kind === k ? "bg-accent text-accent-ink ring-accent" : "ring-line"
                  }`}
                >
                  <ItemIcon name={KIND_ICON[k]} className="h-5 w-5" />
                  {t(`ch.kind.${k}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ch.name")}</span>
            <input className="field" maxLength={120} placeholder={t("ch.namePh")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          {form.kind === "language_words" && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ch.language")}</span>
              <select className="field" value={form.language_code} onChange={(e) => setForm({ ...form, language_code: e.target.value })}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {t(`lang.${l}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ch.target")}</span>
              <input className="field" inputMode="numeric" required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ch.days")}</span>
              <input className="field" inputMode="numeric" required value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value.replace(/\D/g, "") })} />
            </label>
          </div>
          {form.kind === "custom" && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ch.unit")}</span>
              <input className="field" maxLength={24} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
          )}
          {Number(form.target) > 0 && Number(form.days) > 0 && (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
              {t("ch.perDay", {
                n: Math.ceil(Number(form.target) / Number(form.days)),
                unit:
                  form.kind === "custom"
                    ? form.unit || "×"
                    : t(form.kind === "reading_pages" ? "ch.unit.pages" : "ch.unit.words"),
              })}
            </p>
          )}
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={!Number(form.target) || !Number(form.days)}>
            {t("ch.create")}
          </button>
        </form>
      </Sheet>
    </>
  );
}

export default function ChallengesPage() {
  return (
    <AppShell>
      <ChallengesView />
    </AppShell>
  );
}

"use client";

import { LayoutTemplate, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { ItemForm, draftFrom, draftToInput, type ItemDraft } from "@/components/ItemForm";
import { ItemIcon } from "@/components/ItemIcon";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type Lang, type MessageKey } from "@/lib/i18n";
import { ALL_DAYS, CATEGORIES, hm, type Category, type RoutineItem, type Template } from "@/lib/types";

const tr = (v: Record<string, string> | null | undefined, lang: Lang) => (v ? v[lang] ?? v.uz ?? "" : "");

function daysLabel(mask: number, t: (k: MessageKey) => string) {
  if (mask === ALL_DAYS) return t("routine.everyDay");
  return Array.from({ length: 7 }, (_, i) => (mask & (1 << i) ? t(`day.${i}` as MessageKey) : null))
    .filter(Boolean)
    .join(" ");
}

type Mode = { id: string; type: string; starts_on: string | null; ends_on: string | null; is_active: boolean };

function RamadanCard({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode | null | undefined>(undefined);
  const [range, setRange] = useState({ starts_on: "", ends_on: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const modes = await api<Mode[]>("/api/v1/modes", { auth: true });
    const r = modes.find((m) => m.type === "ramadan") ?? null;
    setMode(r);
    if (r) setRange({ starts_on: r.starts_on ?? "", ends_on: r.ends_on ?? "" });
  }, []);
  useEffect(() => {
    load().catch(() => setMode(null));
  }, [load]);

  if (mode === undefined) return null;

  return (
    <section className="card mt-8 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">🌙 {t("rm.title")}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t("rm.hint")}</p>
        </div>
        {mode && <span className="shrink-0 rounded-full bg-success/12 px-3 py-1 text-xs font-bold text-success">✓ {t("rm.enabled")}</span>}
      </div>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api("/api/v1/modes/ramadan", { method: "POST", auth: true, body: range });
            await load();
            onChange();
          } catch (err) {
            setError(errorText(err, t));
          }
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("rm.start")}</span>
          <input type="date" className="field" required value={range.starts_on} onChange={(e) => setRange({ ...range, starts_on: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("rm.end")}</span>
          <input type="date" className="field" required value={range.ends_on} onChange={(e) => setRange({ ...range, ends_on: e.target.value })} />
        </label>
        <button className="btn-primary">{mode ? t("common.save") : t("rm.enable")}</button>
      </form>
      {mode && (
        <button
          className="mt-3 text-xs font-semibold text-ink-faint hover:text-danger"
          onClick={async () => {
            await api(`/api/v1/modes/${mode.id}`, { method: "DELETE", auth: true });
            setMode(null);
            setRange({ starts_on: "", ends_on: "" });
            onChange();
          }}
        >
          {t("common.delete")}
        </button>
      )}
      {error && (
        <div className="mt-3">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}
    </section>
  );
}

function RoutineView() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<RoutineItem[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<null | "templates" | "new" | RoutineItem>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");

  const load = useCallback(async () => {
    try {
      const [list, prayerDays] = await Promise.all([
        api<RoutineItem[]>("/api/v1/routine-items", { auth: true }),
        api<{ times: Record<string, string> }[]>("/api/v1/prayer/times", { auth: true }),
      ]);
      // Namozga bog'langanlar — bugungi namoz vaqti bo'yicha tartiblanadi
      const times = prayerDays[0]?.times ?? {};
      const key = (i: RoutineItem) =>
        (i.time_from_prayer && i.prayer_name ? times[i.prayer_name] : i.start_time) ?? "99";
      setItems([...list].sort((a, b) => key(a).localeCompare(key(b)) || a.sort_order - b.sort_order));
    } catch (err) {
      setError(errorText(err, t));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (sheet === "templates" && templates.length === 0) {
      api<Template[]>("/api/v1/templates", { auth: true }).then(setTemplates).catch(() => {});
    }
  }, [sheet, templates.length]);

  const close = useCallback(() => {
    setSheet(null);
    setFormError("");
  }, []);

  async function save(d: ItemDraft) {
    setBusy(true);
    setFormError("");
    try {
      const body = draftToInput(d);
      if (sheet && typeof sheet === "object") {
        await api(`/api/v1/routine-items/${sheet.id}`, { method: "PATCH", auth: true, body });
      } else {
        await api("/api/v1/routine-items", { method: "POST", auth: true, body });
      }
      await load();
      close();
    } catch (err) {
      setFormError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: RoutineItem) {
    if (!window.confirm(t("routine.confirmDelete"))) return;
    setBusy(true);
    try {
      await api(`/api/v1/routine-items/${item.id}`, { method: "DELETE", auth: true });
      await load();
      close();
    } catch (err) {
      setFormError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate(tpl: Template) {
    setBusy(true);
    try {
      await api("/api/v1/routine-items", {
        method: "POST",
        auth: true,
        body: {
          template_id: tpl.id,
          title: tr(tpl.title, lang),
          category: tpl.category,
          icon: tpl.icon,
          start_time: tpl.default_time,
          duration_min: tpl.default_duration_min,
          prayer_name: tpl.prayer_name,
          time_from_prayer: tpl.prayer_name !== null,
          target_value: tpl.default_target,
          unit: tr(tpl.unit, lang) || null,
          min_version_text: tr(tpl.min_version, lang) || null,
        },
      });
      await load();
      close();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  const visibleTemplates = useMemo(
    () => templates.filter((x) => filter === "all" || x.category === filter),
    [templates, filter],
  );
  const usedTemplates = useMemo(() => new Set(items?.map((i) => i.template_id)), [items]);

  return (
    <>
      <h1 className="animate-rise font-serif text-3xl tracking-tight sm:text-4xl">{t("routine.title")}</h1>
      <p className="animate-rise mt-2 text-ink-soft" style={{ animationDelay: "0.05s" }}>
        {t("routine.subtitle")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="btn-ghost" onClick={() => setSheet("templates")}>
          <LayoutTemplate className="h-4 w-4" /> {t("routine.fromTemplate")}
        </button>
        <button className="btn-primary" onClick={() => setSheet("new")}>
          <Plus className="h-4 w-4" /> {t("routine.custom")}
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      {items && items.length === 0 && <p className="card mt-6 p-8 text-center text-ink-soft">{t("routine.empty")}</p>}

      <ul className="mt-6 space-y-2">
        {items?.map((item, i) => (
          <li key={item.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}>
            <button
              onClick={() => setSheet(item)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left ring-1 ring-line transition-colors hover:bg-surface-2"
            >
              <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-ink-faint">
                {item.time_from_prayer ? t(`prayer.${item.prayer_name}` as MessageKey) : hm(item.start_time)}
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-highlight">
                <ItemIcon name={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{item.title}</span>
                <span className="block truncate text-xs text-ink-faint">
                  {[
                    t(`cat.${item.category}` as MessageKey),
                    item.duration_min ? `${item.duration_min} ${t("common.min")}` : null,
                    daysLabel(item.days_of_week, t),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <RamadanCard onChange={load} />

      <Sheet open={sheet === "templates"} onClose={close} title={t("routine.templates")}>
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ring-1 ${
                filter === c ? "bg-accent text-accent-ink ring-accent" : "ring-line"
              }`}
            >
              {c === "all" ? "∗" : t(`cat.${c}` as MessageKey)}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {visibleTemplates.map((tpl) => {
            const used = usedTemplates.has(tpl.id);
            return (
              <li key={tpl.id}>
                <button
                  disabled={busy}
                  onClick={() => addTemplate(tpl)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ring-1 ring-line transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-highlight">
                    <ItemIcon name={tpl.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{tr(tpl.title, lang)}</span>
                    <span className="block truncate text-xs text-ink-faint">
                      {tpl.prayer_name ? t("routine.fromPrayer") : hm(tpl.default_time)}
                      {tpl.default_duration_min ? ` · ${tpl.default_duration_min} ${t("common.min")}` : ""}
                    </span>
                  </span>
                  <span className={`text-xs font-bold ${used ? "text-ink-faint" : "text-highlight"}`}>
                    {used ? "✓" : `+ ${t("common.add")}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === "new" || (sheet !== null && typeof sheet === "object")}
        onClose={close}
        title={sheet === "new" ? t("routine.new") : t("routine.editItem")}
      >
        {(sheet === "new" || (sheet && typeof sheet === "object")) && (
          <ItemForm
            key={typeof sheet === "object" ? sheet.id : "new"}
            initial={draftFrom(typeof sheet === "object" ? sheet : undefined)}
            onSubmit={save}
            onDelete={typeof sheet === "object" ? () => remove(sheet) : undefined}
            error={formError}
            busy={busy}
          />
        )}
      </Sheet>
    </>
  );
}

export default function RoutinePage() {
  return (
    <AppShell>
      <RoutineView />
    </AppShell>
  );
}

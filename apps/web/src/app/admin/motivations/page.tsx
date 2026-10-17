"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { I18nFields, type I18nText } from "@/components/admin/I18nFields";
import { FormMessage } from "@/components/AuthShell";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type M = {
  id: string;
  text: I18nText;
  author: string | null;
  category: string;
  is_active: boolean;
  publish_on: string | null;
  created_at: string;
};

const CATS: Record<string, string> = {
  discipline: "Intizom",
  time: "Vaqt",
  faith: "Iymon",
  study: "O'qish",
  sport: "Sport",
  general: "Umumiy",
};

type Draft = { text: I18nText; author: string; category: string; is_active: boolean; publish_on: string };
const EMPTY: Draft = { text: {}, author: "", category: "general", is_active: true, publish_on: "" };

export default function AdminMotivations() {
  const { t } = useI18n();
  const [items, setItems] = useState<M[]>([]);
  const [editing, setEditing] = useState<M | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await api<M[]>("/api/v1/admin/motivations", { auth: true }));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  function open(m: M | "new") {
    setError("");
    setEditing(m);
    setDraft(
      m === "new"
        ? EMPTY
        : { text: m.text, author: m.author ?? "", category: m.category, is_active: m.is_active, publish_on: m.publish_on ?? "" },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { ...draft, author: draft.author.trim() || null, publish_on: draft.publish_on || null };
    try {
      if (editing === "new") await api("/api/v1/admin/motivations", { method: "POST", auth: true, body });
      else if (editing) await api(`/api/v1/admin/motivations/${editing.id}`, { method: "PATCH", auth: true, body });
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: M) {
    await api(`/api/v1/admin/motivations/${m.id}`, { method: "PATCH", auth: true, body: { is_active: !m.is_active } });
    await load();
  }

  async function remove(m: M) {
    if (!window.confirm("Motivatsiya o'chirilsinmi?")) return;
    await api(`/api/v1/admin/motivations/${m.id}`, { method: "DELETE", auth: true });
    await load();
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl">Motivatsiyalar</h1>
        <button className="btn-primary h-11 px-5 text-sm" onClick={() => open("new")}>
          + Yangi
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Sanasi belgilangan motivatsiya o'sha kuni "Kun motivatsiyasi" bo'ladi. Aks holda ro'yxatdan har kuni navbat bilan chiqadi.
      </p>
      {error && !editing && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {items.map((m) => (
          <li key={m.id} className={`card flex items-start gap-4 p-4 ${m.is_active ? "" : "opacity-55"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg leading-snug">{m.text.uz}</p>
              <p className="mt-1.5 text-xs text-ink-faint">
                {CATS[m.category]}
                {m.author ? ` · ${m.author}` : ""}
                {m.publish_on ? ` · 📌 ${m.publish_on}` : ""}
                {` · ${["ru", "en"].filter((l) => m.text[l as "ru" | "en"]).join("/") || "faqat uz"}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => toggle(m)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${m.is_active ? "bg-success/12 text-success" : "bg-surface-2 text-ink-soft"}`}
              >
                {m.is_active ? "Faol" : "O'chiq"}
              </button>
              <button className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2" onClick={() => open(m)} aria-label="Tahrirlash">
                <Pencil className="h-4 w-4" />
              </button>
              <button className="grid h-8 w-8 place-items-center rounded-full text-danger hover:bg-danger/10" onClick={() => remove(m)} aria-label="O'chirish">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Yangi motivatsiya" : "Tahrirlash"}>
        <form onSubmit={save} className="space-y-4">
          <I18nFields label="Matn" value={draft.text} onChange={(text) => setDraft({ ...draft, text })} multiline required />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Kategoriya</span>
              <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {Object.entries(CATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Kun motivatsiyasi sanasi</span>
              <input type="date" className="field" value={draft.publish_on} onChange={(e) => setDraft({ ...draft, publish_on: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">Muallif (ixtiyoriy)</span>
            <input className="field" maxLength={120} value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} />
          </label>
          <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-semibold">Faol</span>
            <input type="checkbox" className="h-5 w-5 accent-[var(--caramel)]" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
          </label>
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={busy || !draft.text.uz?.trim()}>
            Saqlash
          </button>
        </form>
      </Sheet>
    </div>
  );
}

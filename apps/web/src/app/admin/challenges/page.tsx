"use client";

import { useCallback, useEffect, useState } from "react";
import { I18nFields, type I18nText } from "@/components/admin/I18nFields";
import { FormMessage } from "@/components/AuthShell";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type Row = {
  id: string;
  title: I18nText;
  kind: string;
  target_value: number;
  unit: string;
  duration_days: number;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  participants: number;
};

const KINDS = { language_words: "Til — so'z", reading_pages: "Kitob — bet", custom: "Boshqa" };
const EMPTY = { kind: "language_words", title: {} as I18nText, description: {} as I18nText, target_value: "1000", unit: "so'z", duration_days: "30", starts_on: "" };

export default function AdminChallenges() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const load = useCallback(async () => setRows(await api<Row[]>("/api/v1/admin/challenges", { auth: true })), []);
  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/v1/admin/challenges", {
        method: "POST",
        auth: true,
        body: {
          ...form,
          target_value: Number(form.target_value),
          duration_days: Number(form.duration_days),
          starts_on: form.starts_on || null,
        },
      });
      setOpen(false);
      setForm(EMPTY);
      await load();
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl">Umumiy challenge'lar</h1>
        <button className="btn-primary h-11 px-5 text-sm" onClick={() => setOpen(true)}>
          + Yangi
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Hamma qo'shila oladigan challenge: reyting bilan. Sana belgilansa — hamma uchun bir xil muddat, aks holda har kim qo'shilgan kunidan boshlaydi.
      </p>
      {error && !open && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}
      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`card flex items-center gap-4 p-4 ${r.is_active ? "" : "opacity-55"}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title.uz}</p>
              <p className="text-xs text-ink-faint">
                {KINDS[r.kind as keyof typeof KINDS]} · {r.target_value} {r.unit} / {r.duration_days} kun
                {r.starts_on ? ` · ${r.starts_on} → ${r.ends_on}` : ""} · {r.participants} ishtirokchi
              </p>
            </div>
            <button
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${r.is_active ? "bg-success/12 text-success" : "bg-surface-2 text-ink-soft"}`}
              onClick={async () => {
                await api(`/api/v1/admin/challenges/${r.id}`, { method: "PATCH", auth: true, body: { is_active: !r.is_active } });
                await load();
              }}
            >
              {r.is_active ? "Faol" : "O'chiq"}
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open} onClose={() => setOpen(false)} title="Yangi umumiy challenge">
        <form onSubmit={create} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">Turi</span>
            <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <I18nFields label="Nomi" value={form.title} onChange={(title) => setForm({ ...form, title })} required maxLength={120} />
          <I18nFields label="Tavsif" value={form.description} onChange={(description) => setForm({ ...form, description })} multiline maxLength={400} />
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Maqsad</span>
              <input className="field" inputMode="numeric" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Birlik</span>
              <input className="field" maxLength={24} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Kunlar</span>
              <input className="field" inputMode="numeric" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value.replace(/\D/g, "") })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">Boshlanish sanasi (ixtiyoriy)</span>
            <input type="date" className="field" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
          </label>
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={!form.title.uz?.trim()}>
            Saqlash
          </button>
        </form>
      </Sheet>
    </div>
  );
}

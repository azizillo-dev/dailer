"use client";

import { useEffect, useState } from "react";
import { FormMessage } from "./AuthShell";
import { Sheet } from "./Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { hm } from "@/lib/types";

export type Reflection = {
  date: string;
  mood: number | null;
  energy: number | null;
  note: string | null;
  slept_at: string | null;
  woke_at: string | null;
  filled: boolean;
};

const FACES = ["😣", "😕", "😐", "🙂", "😄"];

function Scale({ label, value, onChange, faces }: { label: string; value: number | null; onChange: (v: number) => void; faces?: boolean }) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={label}>
      <span className="mb-2 block text-sm font-semibold text-ink-soft">{label}</span>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={`flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold ring-1 transition-[background-color,transform] active:scale-95 ${
              value === n ? "bg-accent text-accent-ink ring-accent" : "ring-line hover:bg-surface-2"
            }`}
          >
            <span className="text-xl leading-none">{faces ? FACES[n - 1] : n}</span>
            {faces && <span>{t(`refl.m${n}` as MessageKey)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReflectionSheet({
  open,
  date,
  onClose,
  onSaved,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onSaved: (r: Reflection) => void;
}) {
  const { t } = useI18n();
  const [r, setR] = useState<Reflection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Reflection>(`/api/v1/journal/${date}`, { auth: true }).then(setR).catch(() => {});
  }, [open, date]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!r) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api<Reflection>(`/api/v1/journal/${date}`, {
        method: "PUT",
        auth: true,
        body: {
          mood: r.mood,
          energy: r.energy,
          note: r.note?.trim() || null,
          slept_at: r.slept_at || null,
          woke_at: r.woke_at || null,
        },
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("refl.title")}>
      {r && (
        <form onSubmit={save} className="space-y-5">
          <Scale label={t("refl.mood")} value={r.mood} onChange={(mood) => setR({ ...r, mood })} faces />
          <Scale label={t("refl.energy")} value={r.energy} onChange={(energy) => setR({ ...r, energy })} />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("refl.note")}</span>
            <textarea
              className="field h-24 resize-none py-3 leading-relaxed"
              maxLength={500}
              value={r.note ?? ""}
              onChange={(e) => setR({ ...r, note: e.target.value })}
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink-soft">{t("refl.sleep")}</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-ink-faint">{t("refl.slept")}</span>
                <input type="time" className="field" value={hm(r.slept_at)} onChange={(e) => setR({ ...r, slept_at: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-ink-faint">{t("refl.woke")}</span>
                <input type="time" className="field" value={hm(r.woke_at)} onChange={(e) => setR({ ...r, woke_at: e.target.value })} />
              </label>
            </div>
          </fieldset>
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={busy}>
            {t("refl.save")}
          </button>
        </form>
      )}
    </Sheet>
  );
}

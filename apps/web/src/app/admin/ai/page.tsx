"use client";

import { useCallback, useEffect, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type P = {
  id: string;
  code: string;
  name: string;
  model: string;
  priority: number;
  enabled: boolean;
  is_paid: boolean;
  daily_request_cap: number | null;
  api_key_env: string;
  has_key: boolean;
  cooldown_seconds: number;
  today_requests: number;
};

export default function AdminAI() {
  const { t } = useI18n();
  const [rows, setRows] = useState<P[]>([]);
  const [error, setError] = useState("");
  const [test, setTest] = useState<Record<string, string>>({});

  const load = useCallback(async () => setRows(await api<P[]>("/api/v1/admin/ai/providers", { auth: true })), []);
  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  async function patch(p: P, body: Record<string, unknown>) {
    setError("");
    try {
      await api(`/api/v1/admin/ai/providers/${p.id}`, { method: "PATCH", auth: true, body });
      await load();
    } catch (e) {
      setError(errorText(e, t));
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const a = rows[i];
    const b = rows[i + dir];
    if (!a || !b) return;
    await patch(a, { priority: b.priority });
    await patch(b, { priority: a.priority });
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-3xl">AI provayderlar</h1>
      <p className="mt-2 text-sm text-ink-soft">
        So'rov tartib bo'yicha yuqoridan pastga yuboriladi. Limit tugasa yoki xato bo'lsa — keyingisiga o'tadi. Hech biri ishlamasa,
        statistikaga asoslangan shablon javob beriladi. Kalitlar serverning <code className="font-mono">.env</code> faylida.
      </p>
      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}
      <ol className="mt-6 space-y-3">
        {rows.map((p, i) => (
          <li key={p.id} className={`card p-5 ${p.enabled ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 font-serif">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {p.name} {p.is_paid && <span className="ml-1 rounded-full bg-highlight/20 px-2 py-0.5 text-[10px] font-bold text-highlight">pullik</span>}
                </p>
                <p className="text-xs text-ink-faint">
                  {p.has_key ? "✓ kalit bor" : `✗ ${p.api_key_env} yo'q`} · bugun {p.today_requests}
                  {p.daily_request_cap != null ? ` / ${p.daily_request_cap}` : ""} so'rov
                  {p.cooldown_seconds > 0 ? ` · ⏸ ${Math.ceil(p.cooldown_seconds / 60)} daq dam olmoqda` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <button className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-line disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yuqoriga">
                  ↑
                </button>
                <button className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-line disabled:opacity-30" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Pastga">
                  ↓
                </button>
              </div>
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${p.enabled ? "bg-success/12 text-success" : "bg-surface-2 text-ink-soft"}`}
                onClick={() => patch(p, { enabled: !p.enabled })}
              >
                {p.enabled ? "Yoqilgan" : "O'chiq"}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto_auto]">
              <input
                className="field h-10 font-mono text-xs"
                defaultValue={p.model}
                aria-label="Model"
                onBlur={(e) => e.target.value !== p.model && e.target.value.trim() && patch(p, { model: e.target.value.trim() })}
              />
              <input
                className="field h-10 text-xs"
                inputMode="numeric"
                placeholder="kunlik chegara"
                defaultValue={p.daily_request_cap ?? ""}
                aria-label="Kunlik chegara"
                onBlur={(e) => patch(p, { daily_request_cap: e.target.value === "" ? null : Number(e.target.value) })}
              />
              {p.cooldown_seconds > 0 && (
                <button className="btn-ghost h-10 px-4 text-xs" onClick={() => patch(p, { clear_cooldown: true })}>
                  Cooldown'ni olib tashlash
                </button>
              )}
              <button
                className="btn-ghost h-10 px-4 text-xs"
                onClick={async () => {
                  setTest((x) => ({ ...x, [p.id]: "…" }));
                  const r = await api<{ ok: boolean; reply?: string; error?: string; ms?: number }>(`/api/v1/admin/ai/providers/${p.id}/test`, {
                    method: "POST",
                    auth: true,
                  });
                  setTest((x) => ({ ...x, [p.id]: r.ok ? `✓ ${r.ms} ms: ${r.reply}` : `✗ ${r.error}` }));
                }}
              >
                Sinash
              </button>
            </div>
            {test[p.id] && <p className="mt-2 text-xs text-ink-soft">{test[p.id]}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

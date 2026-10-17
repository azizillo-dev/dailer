"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type Row = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "user" | "moderator" | "admin" | "super_admin";
  status: "active" | "blocked" | "pending_deletion";
  email_verified: boolean;
  onboarded: boolean;
  created_at: string;
  last_seen_at: string | null;
};

const STATUS_LABEL: Record<Row["status"], string> = { active: "Faol", blocked: "Bloklangan", pending_deletion: "O'chirilmoqda" };
const PAGE = 25;

export default function AdminUsers() {
  const { t } = useI18n();
  const { me } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState<{ total: number; items: Row[] } | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    try {
      setData(await api(`/api/v1/admin/users?${params}`, { auth: true }));
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [q, status, offset, t]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  async function patch(u: Row, body: Partial<Pick<Row, "role" | "status">>) {
    setError("");
    try {
      await api(`/api/v1/admin/users/${u.id}`, { method: "PATCH", auth: true, body });
      await load();
    } catch (e) {
      setError(errorText(e, t));
    }
  }

  const isSuper = me?.role === "super_admin";

  return (
    <div className="max-w-6xl">
      <h1 className="font-serif text-3xl">Foydalanuvchilar</h1>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            className="field pl-11"
            placeholder="Email yoki ism"
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
          />
        </label>
        <select className="field sm:w-48" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
          <option value="">Barcha holatlar</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-ink-faint">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">Foydalanuvchi</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Holat</th>
              <th className="px-4 py-3 font-semibold">Ro'yxat</th>
              <th className="px-4 py-3 font-semibold">Oxirgi faollik</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => {
              const self = u.id === me?.id;
              const protectedRow = self || u.role === "super_admin" || (!isSuper && u.role === "admin");
              return (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{u.full_name || "—"}</p>
                    <p className="text-xs text-ink-faint">
                      {u.email} {u.email_verified ? "✓" : ""} {u.onboarded ? "" : "· onboarding yo'q"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {isSuper && !protectedRow ? (
                      <select
                        className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs font-semibold"
                        value={u.role}
                        onChange={(e) => patch(u, { role: e.target.value as Row["role"] })}
                      >
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span className="text-xs font-semibold">{u.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        u.status === "active" ? "bg-success/12 text-success" : u.status === "blocked" ? "bg-danger/10 text-danger" : "bg-surface-2 text-ink-soft"
                      }`}
                    >
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{new Date(u.created_at).toLocaleDateString("uz-Latn")}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString("uz-Latn") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!protectedRow &&
                      (u.status === "blocked" ? (
                        <button className="text-xs font-bold text-success hover:underline" onClick={() => patch(u, { status: "active" })}>
                          Blokdan chiqarish
                        </button>
                      ) : (
                        <button
                          className="text-xs font-bold text-danger hover:underline"
                          onClick={() => window.confirm(`${u.email} bloklansinmi?`) && patch(u, { status: "blocked" })}
                        >
                          Bloklash
                        </button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span>
            {data.total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, data.total)} / {data.total}
          </span>
          <div className="flex gap-2">
            <button className="btn-ghost h-9 px-4 text-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              ←
            </button>
            <button className="btn-ghost h-9 px-4 text-sm" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

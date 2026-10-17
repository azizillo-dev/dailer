"use client";

import { useEffect, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type Log = {
  id: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  diff: Record<string, unknown>;
  created_at: string;
};

export default function AdminAudit() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Log[]>("/api/v1/admin/audit-logs?limit=200", { auth: true }).then(setLogs).catch((e) => setError(errorText(e, t)));
  }, [t]);

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-3xl">Audit log</h1>
      <p className="mt-2 text-sm text-ink-soft">Adminlar qilgan barcha o'zgarishlar.</p>
      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}
      <ul className="mt-6 space-y-2">
        {logs.map((l) => (
          <li key={l.id} className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm">
                <span className="font-mono text-xs font-bold text-highlight">{l.action}</span>{" "}
                <span className="text-ink-soft">{l.actor ?? "—"}</span>
              </p>
              <p className="text-xs text-ink-faint">{new Date(l.created_at).toLocaleString("uz-Latn")}</p>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-ink-faint">
                {l.entity} {l.entity_id?.slice(0, 8)}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed">{JSON.stringify(l.diff, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

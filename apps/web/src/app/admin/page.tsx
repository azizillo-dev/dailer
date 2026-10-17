"use client";

import { useEffect, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

type Dashboard = {
  users_total: number;
  users_new_7d: number;
  dau: number;
  wau: number;
  mau: number;
  onboarding_rate: number | null;
  retention_d7: number | null;
  series: { date: string; signups: number; checkins: number }[];
};

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-ink-faint">{label}</p>
      <p className="mt-2 font-serif text-4xl leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Bitta seriya — oddiy ustunli grafik, hover'da qiymat. */
function MiniBars({ title, data }: { title: string; data: { date: string; v: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.v));
  const total = data.reduce((s, d) => s + d.v, 0);
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg">{title}</h2>
        <p className="text-sm tabular-nums text-ink-soft">
          {hover != null ? `${data[hover].date.slice(5)}: ${data[hover].v}` : `14 kun: ${total}`}
        </p>
      </div>
      <div className="mt-5 flex h-28 items-end gap-1.5">
        {data.map((d, i) => (
          <div
            key={d.date}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            title={`${d.date}: ${d.v}`}
          >
            <span
              className={`w-full rounded-t-[4px] bg-caramel transition-opacity ${hover != null && hover !== i ? "opacity-45" : ""}`}
              style={{ height: d.v ? `${Math.max(4, (d.v / max) * 100)}%` : 2 }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const { t } = useI18n();
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/v1/admin/dashboard", { auth: true }).then(setD).catch((e) => setError(errorText(e, t)));
  }, [t]);

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-3xl">Dashboard</h1>
      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}
      {d && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Jami foydalanuvchilar" value={d.users_total} hint={`+${d.users_new_7d} oxirgi 7 kunda`} />
            <Tile label="Faol (24 soat)" value={d.dau} hint={`7 kun: ${d.wau} · 30 kun: ${d.mau}`} />
            <Tile label="Onboarding tugatgan" value={d.onboarding_rate == null ? "–" : `${d.onboarding_rate}%`} />
            <Tile
              label="7 kunlik qaytish"
              value={d.retention_d7 == null ? "–" : `${d.retention_d7}%`}
              hint="7–14 kun oldin kelganlardan"
            />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <MiniBars title="Ro'yxatdan o'tishlar" data={d.series.map((s) => ({ date: s.date, v: s.signups }))} />
            <MiniBars title="Check-in'lar" data={d.series.map((s) => ({ date: s.date, v: s.checkins }))} />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { ArrowLeft, Crown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { ChallengeCard, type ChallengeSummary } from "@/components/ChallengeCard";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { localISODate } from "@/lib/types";

type Row = { rank: number; name: string; avatar_url: string | null; progress: number; completed: boolean; me: boolean };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localISODate(d);
}

function DetailView() {
  const { t, lang } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<ChallengeSummary | null>(null);
  const [board, setBoard] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<number | null>(null);

  const load = useCallback(async () => {
    const d = await api<ChallengeSummary>(`/api/v1/challenges/${id}`, { auth: true });
    setC(d);
    if (d.is_public) setBoard(await api<Row[]>(`/api/v1/challenges/${id}/leaderboard`, { auth: true }));
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  // Challenge'ning butun muddati: o'tgan kunlar — qiymat, kelajak — bo'sh joy
  const days = useMemo(() => {
    if (!c?.starts_on) return [];
    const byDate = new Map((c.logs ?? []).map((l) => [l.date, l.value]));
    const today = localISODate();
    const last = c.ends_on ?? addDays(c.starts_on, c.duration_days - 1);
    const out: { date: string; v: number; future: boolean }[] = [];
    for (let d = c.starts_on; d <= last && out.length < 366; d = addDays(d, 1)) {
      out.push({ date: d, v: byDate.get(d) ?? 0, future: d > today });
    }
    return out;
  }, [c]);
  const max = Math.max(1, ...days.map((d) => d.v), c ? Math.ceil(c.target_value / c.duration_days) : 1);
  const perDay = c ? c.target_value / c.duration_days : 0;

  if (!c) return error ? <FormMessage kind="error">{error}</FormMessage> : null;

  return (
    <>
      <Link href="/challenges" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {t("ch.title")}
      </Link>
      <h1 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">{c.title}</h1>
      {c.description && <p className="mt-2 text-ink-soft">{c.description}</p>}

      <div className="mt-6">
        <ChallengeCard c={c} hideTitle onChange={(n) => setC({ ...n })} />
      </div>

      {days.length > 0 && (
        <section className="card mt-3 p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-xl">{t("ch.history")}</h2>
            <p className="text-sm tabular-nums text-ink-soft">
              {hover != null
                ? `${new Date(`${days[hover].date}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { day: "numeric", month: "short" })}: ${days[hover].v} ${c.unit}`
                : ""}
            </p>
          </div>
          <div className="relative mt-5 h-32">
            {/* Rejadagi kunlik me'yor */}
            <div
              className="absolute inset-x-0 border-t border-dashed border-highlight/60"
              style={{ bottom: `${(perDay / max) * 100}%` }}
              aria-hidden
            />
            <div className="absolute inset-0 flex items-end gap-1">
              {days.map((d, i) => (
                <div
                  key={d.date}
                  className="flex h-full flex-1 items-end"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  title={`${d.date}: ${d.v}`}
                >
                  <span
                    className={`mx-auto w-full max-w-8 rounded-t-[4px] transition-opacity ${d.future ? "bg-line" : "bg-caramel"} ${
                      hover != null && hover !== i ? "opacity-45" : ""
                    }`}
                    style={{ height: d.v ? `${Math.max(4, (d.v / max) * 100)}%` : 2 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {c.is_public && board.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-xl">{t("ch.leaderboard")}</h2>
          <ol className="mt-3 space-y-2">
            {board.map((r) => (
              <li key={r.rank} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${r.me ? "bg-surface-2 ring-highlight" : "bg-surface ring-line"}`}>
                <span className="w-6 text-center font-serif text-lg text-ink-faint">{r.rank === 1 ? <Crown className="mx-auto h-4 w-4 text-highlight" /> : r.rank}</span>
                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-surface-2 text-sm font-bold text-highlight">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : r.name.slice(0, 1)}
                </span>
                <span className="flex-1 truncate font-semibold">{r.name}</span>
                <span className="text-sm font-bold tabular-nums">
                  {r.progress} {c.unit} {r.completed ? "✓" : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.joined && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-semibold">{t("ch.showProfile")}</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--caramel)]"
              checked={c.show_on_profile ?? true}
              onChange={async (e) => {
                setC({ ...c, show_on_profile: e.target.checked });
                await api(`/api/v1/challenges/${c.id}/profile?show=${e.target.checked}`, { method: "PATCH", auth: true }).catch(() => {});
              }}
            />
          </label>
          <button
            className="btn-ghost text-danger"
            onClick={async () => {
              if (!window.confirm(t("ch.leaveConfirm"))) return;
              await api(`/api/v1/challenges/${c.id}/leave`, { method: "POST", auth: true });
              router.replace("/challenges");
            }}
          >
            {t("ch.leave")}
          </button>
        </div>
      )}
    </>
  );
}

export default function ChallengeDetailPage() {
  return (
    <AppShell>
      <DetailView />
    </AppShell>
  );
}

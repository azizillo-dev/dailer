"use client";

import { Check, ChevronLeft, ChevronRight, ListTodo, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BannerCarousel } from "@/components/BannerCarousel";
import { ChallengeCard, type ChallengeSummary } from "@/components/ChallengeCard";
import { MotivationCard, type Motivation } from "@/components/MotivationCard";
import { FormMessage } from "@/components/AuthShell";
import { ItemIcon } from "@/components/ItemIcon";
import { ProgressRing } from "@/components/ProgressRing";
import { ReflectionSheet, type Reflection } from "@/components/ReflectionSheet";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { hm, localISODate, PRAYERS, type Checkin, type CheckinStatus, type Day, type ExcuseReason } from "@/lib/types";

const BACK_DAYS = 7;
type Entry = Day["items"][number];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localISODate(d);
}

function minutesOf(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function recount(items: Entry[]): Day["summary"] {
  const c = { done: 0, partial: 0, missed: 0, excused: 0 };
  for (const e of items) if (e.checkin) c[e.checkin.status] += 1;
  const base = items.length - c.excused;
  return {
    planned: items.length,
    ...c,
    score: base > 0 ? Math.round(((c.done + c.partial * 0.5) / base) * 1000) / 10 : null,
  };
}

function StatusMark({ status }: { status: CheckinStatus | undefined }) {
  if (status === "done") return <Check className="h-4 w-4" strokeWidth={2.6} />;
  if (status === "partial") return <span className="h-2 w-2 rounded-full bg-current" />;
  if (status === "missed") return <Minus className="h-4 w-4" strokeWidth={2.6} />;
  if (status === "excused") return <span className="text-[10px] font-black">U</span>;
  return null;
}

const MARK_STYLE: Record<CheckinStatus, string> = {
  done: "bg-accent text-accent-ink ring-accent",
  partial: "bg-highlight/25 text-highlight ring-highlight",
  missed: "bg-danger/10 text-danger ring-danger/40",
  excused: "bg-surface-2 text-ink-faint ring-line",
};

function TodayView() {
  const { t } = useI18n();
  const { me } = useAuth();
  const today = useMemo(() => localISODate(), []);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (d: string) => {
    setError("");
    try {
      setDay(await api<Day>(`/api/v1/today?date=${d}`, { auth: true }));
    } catch (err) {
      setError(errorText(err, t));
    }
  }, [t]);

  useEffect(() => {
    load(date);
  }, [date, load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [reflectOpen, setReflectOpen] = useState(false);
  useEffect(() => {
    api<Reflection>(`/api/v1/journal/${date}`, { auth: true }).then(setReflection).catch(() => {});
  }, [date]);
  // Kechki xulosa xabaridan kelinganda (?reflect=1) — oyna darhol ochiladi
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reflect") === "1") setReflectOpen(true);
  }, []);

  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  useEffect(() => {
    api<Motivation | null>("/api/v1/motivations/today", { auth: true }).then(setMotivation).catch(() => {});
    // Faol challenge'lar (bugungi kiritilgan qiymat bilan)
    api<ChallengeSummary[]>("/api/v1/challenges", { auth: true })
      .then((list) =>
        Promise.all(
          list
            .filter((c) => !c.finished)
            .slice(0, 4)
            .map((c) => api<ChallengeSummary>(`/api/v1/challenges/${c.id}`, { auth: true })),
        ),
      )
      .then(setChallenges)
      .catch(() => {});
  }, []);

  /** Optimistik: ekranda darhol o'zgaradi, server rad etsa — qaytariladi. */
  async function mark(entry: Entry, status: CheckinStatus | null, extra: Partial<Checkin> = {}) {
    if (!day) return;
    const prev = day;
    const nextCheckin: Checkin | null = status
      ? {
          id: entry.checkin?.id ?? "pending",
          routine_item_id: entry.item.id,
          date: day.date,
          status,
          excuse_reason: status === "excused" ? (extra.excuse_reason ?? "other") : null,
          value: extra.value ?? entry.checkin?.value ?? null,
          note: entry.checkin?.note ?? null,
        }
      : null;
    const items = day.items.map((e) => (e.item.id === entry.item.id ? { ...e, checkin: nextCheckin } : e));
    setDay({ ...day, items, summary: recount(items) });

    try {
      if (status) {
        const saved = await api<Checkin>("/api/v1/checkins?source=web", {
          method: "PUT",
          auth: true,
          body: {
            routine_item_id: entry.item.id,
            date: day.date,
            status,
            excuse_reason: nextCheckin?.excuse_reason,
            value: nextCheckin?.value,
          },
        });
        setDay((d) =>
          d && { ...d, items: d.items.map((e) => (e.item.id === entry.item.id ? { ...e, checkin: saved } : e)) },
        );
      } else if (entry.checkin && entry.checkin.id !== "pending") {
        await api(`/api/v1/checkins/${entry.checkin.id}`, { method: "DELETE", auth: true });
      }
    } catch (err) {
      setDay(prev);
      setError(errorText(err, t));
    }
  }

  const nextPrayer = useMemo(() => {
    if (!day || date !== today || !me?.profile.prays) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const p of PRAYERS) {
      const time = day.prayer_times[p];
      if (time && minutesOf(time) > nowMin) return { name: p, time: hm(time), left: minutesOf(time) - nowMin };
    }
    return null;
  }, [day, date, today, now, me]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const currentId = useMemo(() => {
    if (!day || date !== today) return null;
    let current: string | null = null;
    for (const e of day.items) if (e.time && minutesOf(e.time) <= nowMin) current = e.item.id;
    return current;
  }, [day, date, today, nowMin]);

  if (!me) return null;
  const summary = day?.summary;
  const firstName = me.profile.full_name.split(" ")[0];
  const label =
    date === today ? t("today.today") : date === addDays(today, -1) ? t("today.yesterday") :
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      {/* Oliy maqsad — har kuni ko'z oldida */}
      <section className="card animate-rise overflow-hidden">
        <div className="bg-espresso px-5 py-4 text-cream sm:px-7">
          <p className="font-serif text-lg italic sm:text-xl">“{t("brand.motto")}”</p>
        </div>
        {me.profile.main_goal && (
          <p className="px-5 py-4 font-serif text-xl leading-snug sm:px-7">{me.profile.main_goal}</p>
        )}
      </section>

      <div className="mt-4">
        <BannerCarousel />
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{label}</p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
            {t("today.hello")}, {firstName}!
          </h1>
        </div>
        <div className="flex gap-1.5">
          <Link
            href="/routine"
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line md:hidden"
            aria-label={t("nav.routine")}
            title={t("nav.routine")}
          >
            <ListTodo className="h-4 w-4" />
          </Link>
          <button
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line disabled:opacity-30"
            onClick={() => setDate(addDays(date, -1))}
            disabled={date <= addDays(today, -BACK_DAYS)}
            aria-label="←"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line disabled:opacity-30"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= today}
            aria-label="→"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="card flex items-center gap-5 p-5">
          <ProgressRing value={summary?.score != null ? summary.score / 100 : 0}>
            <span className="font-serif text-lg">{summary?.score != null ? Math.round(summary.score) : "–"}</span>
          </ProgressRing>
          <div>
            <p className="text-sm font-semibold text-ink-soft">{t("today.score")}</p>
            <p className="mt-1 font-serif text-2xl">
              {t("today.of", { done: summary?.done ?? 0, total: summary?.planned ?? 0 })}
            </p>
          </div>
        </div>
        {nextPrayer && (
          <div className="card flex items-center gap-4 p-5 sm:min-w-56">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-highlight">
              <ItemIcon name="moon" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-soft">{t("today.nextPrayer")}</p>
              <p className="mt-0.5 font-serif text-xl">
                {t(`prayer.${nextPrayer.name}` as MessageKey)} · {nextPrayer.time}
              </p>
              <p className="text-xs text-ink-faint">
                {t("today.in", {
                  t: nextPrayer.left >= 60 ? `${Math.floor(nextPrayer.left / 60)}:${String(nextPrayer.left % 60).padStart(2, "0")}` : `${nextPrayer.left} ${t("common.min")}`,
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      <ol className="mt-6 space-y-2.5">
        {day?.items.map((entry, i) => {
          const status = entry.checkin?.status;
          const isNow = entry.item.id === currentId && !status;
          return (
            <li
              key={entry.item.id}
              className={`animate-rise flex items-center gap-3 rounded-2xl bg-surface px-3 py-3 ring-1 transition-[box-shadow,opacity] sm:px-4 ${
                isNow ? "ring-2 ring-highlight" : "ring-line"
              } ${status === "excused" || status === "missed" ? "opacity-70" : ""}`}
              style={{ animationDelay: `${Math.min(i, 12) * 0.03}s` }}
            >
              <span className="w-11 shrink-0 text-xs font-bold tabular-nums text-ink-faint">{hm(entry.time)}</span>
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setOpen(entry)}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-highlight">
                  <ItemIcon name={entry.item.icon} />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[15px] font-semibold ${status === "done" ? "text-ink-soft line-through decoration-highlight/60" : ""}`}>
                    {entry.item.title}
                  </span>
                  <span className="block truncate text-xs text-ink-faint">
                    {[
                      entry.item.duration_min ? `${entry.item.duration_min} ${t("common.min")}` : null,
                      entry.item.target_value ? `${entry.checkin?.value ?? 0}/${Number(entry.item.target_value)} ${entry.item.unit ?? ""}` : null,
                      status && status !== "done" ? t(`status.${status}` as MessageKey) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
              <button
                onClick={() => mark(entry, status === "done" ? null : "done")}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 transition-[transform,background-color] duration-200 active:scale-90 ${
                  status ? MARK_STYLE[status] : "text-transparent ring-line hover:ring-highlight"
                }`}
                aria-label={t("status.done")}
                aria-pressed={status === "done"}
              >
                <StatusMark status={status} />
              </button>
            </li>
          );
        })}
      </ol>

      {day && day.items.length === 0 && (
        <div className="card mt-6 p-8 text-center">
          <p className="text-ink-soft">{t("today.empty")}</p>
          <Link href="/routine" className="btn-primary mt-5">
            <Plus className="h-4 w-4" /> {t("today.addFirst")}
          </Link>
        </div>
      )}

      {day && day.items.length > 0 && (
        <button
          onClick={() => setReflectOpen(true)}
          className="card mt-6 flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-surface-2"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">
            {reflection?.filled ? ["😣", "😕", "😐", "🙂", "😄"][(reflection.mood ?? 3) - 1] : "🌙"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{reflection?.filled ? t("refl.done") : t("refl.title")}</span>
            <span className="block truncate text-sm text-ink-faint">{reflection?.note || t("refl.note")}</span>
          </span>
          <span className="text-sm font-semibold text-highlight">{t("refl.cta")} →</span>
        </button>
      )}

      {challenges.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">{t("ch.title")}</h2>
            <Link href="/challenges" className="text-sm font-semibold text-highlight hover:underline">
              {t("mot.all")} →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((c) => (
              <ChallengeCard key={c.id} c={c} compact onChange={(n) => setChallenges((all) => all.map((x) => (x.id === n.id ? n : x)))} />
            ))}
          </div>
        </section>
      )}

      {motivation && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl">{t("mot.today")}</h2>
            <Link href="/motivations" className="text-sm font-semibold text-highlight hover:underline">
              {t("mot.all")} →
            </Link>
          </div>
          <MotivationCard m={motivation} />
        </section>
      )}

      <ReflectionSheet open={reflectOpen} date={date} onClose={() => setReflectOpen(false)} onSaved={setReflection} />

      <CheckinSheet
        entry={open}
        female={me.profile.gender === "female"}
        onClose={() => setOpen(null)}
        onMark={async (status, extra) => {
          if (open) await mark(open, status, extra);
          setOpen(null);
        }}
      />
    </>
  );
}

function CheckinSheet({
  entry,
  female,
  onClose,
  onMark,
}: {
  entry: Entry | null;
  female: boolean;
  onClose: () => void;
  onMark: (status: CheckinStatus | null, extra?: Partial<Checkin>) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [excusing, setExcusing] = useState(false);

  useEffect(() => {
    setValue(entry?.checkin?.value != null ? String(Number(entry.checkin.value)) : "");
    setExcusing(false);
  }, [entry]);

  const reasons: ExcuseReason[] = female ? ["sick", "travel", "menstruation", "other"] : ["sick", "travel", "other"];
  const val = value === "" ? undefined : Number(value);

  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry?.item.title}>
      {entry && (
        <div className="space-y-5">
          {entry.item.min_version_text && (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
              {t("today.minVersion", { text: entry.item.min_version_text })}
            </p>
          )}
          {entry.item.unit && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">
                {t("today.value", { unit: entry.item.unit })}
              </span>
              <input
                className="field"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={entry.item.target_value ? String(Number(entry.item.target_value)) : "0"}
              />
            </label>
          )}

          {excusing ? (
            <div>
              <p className="mb-3 text-sm font-semibold text-ink-soft">{t("excuse.title")}</p>
              <div className="grid grid-cols-2 gap-2">
                {reasons.map((r) => (
                  <button
                    key={r}
                    className="btn-ghost"
                    onClick={() => onMark("excused", { excuse_reason: r, value: val })}
                  >
                    {t(`excuse.${r}` as MessageKey)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary col-span-2" onClick={() => onMark("done", { value: val })}>
                <Check className="h-4 w-4" /> {t("status.done")}
              </button>
              <button className="btn-ghost" onClick={() => onMark("partial", { value: val })}>
                {t("status.partial")}
              </button>
              <button className="btn-ghost" onClick={() => onMark("missed", { value: val })}>
                {t("status.missed")}
              </button>
              <button className="btn-ghost col-span-2" onClick={() => setExcusing(true)}>
                {t("status.excused")}
              </button>
              {entry.checkin && (
                <button
                  className="col-span-2 mt-1 text-sm font-semibold text-ink-faint hover:text-ink"
                  onClick={() => onMark(null)}
                >
                  {t("status.clear")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default function TodayPage() {
  return (
    <AppShell>
      <TodayView />
    </AppShell>
  );
}

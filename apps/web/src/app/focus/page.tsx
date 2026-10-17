"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProgressRing } from "@/components/ProgressRing";
import { api } from "@/lib/api";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localISODate, type Day } from "@/lib/types";

type Mode = "focus" | "short_break" | "long_break";
const MODE_LABEL: Record<Mode, MessageKey> = { focus: "focus.focus", short_break: "focus.short", long_break: "focus.long" };
const DEFAULTS: Record<Mode, number> = { focus: 25, short_break: 5, long_break: 15 };
const STORE = "dailer.focus";
const DURATIONS = "dailer.focus.durations";

type Running = {
  mode: Mode;
  /** Tugash vaqti (ms). To'xtatilganda — null, qolgan vaqt `remaining` da. */
  endAt: number | null;
  remaining: number;
  startedAt: number;
  taskId: string | null;
  clientId: string;
};

type Stats = {
  total_minutes: number;
  days: { date: string; minutes: number; sessions: number }[];
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 880 : 660;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {}
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function FocusView() {
  const { t } = useI18n();
  const [durations, setDurations] = useState<Record<Mode, number>>(DEFAULTS);
  const [mode, setMode] = useState<Mode>("focus");
  const [run, setRun] = useState<Running | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tasks, setTasks] = useState<Day["items"]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const [toast, setToast] = useState("");
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const finishing = useRef(false);

  const refreshStats = useCallback(() => {
    api<Stats>("/api/v1/pomodoro/stats", { auth: true })
      .then((s) => {
        setStats(s);
        const today = s.days.find((d) => d.date === localISODate());
        setCompletedToday(today?.sessions ?? 0);
      })
      .catch(() => {});
  }, []);

  // Saqlangan holatni tiklash (sahifa yangilansa ham taymer davom etadi)
  useEffect(() => {
    setDurations({ ...DEFAULTS, ...load(DURATIONS, {}) });
    const saved = load<Running | null>(STORE, null);
    if (saved) {
      setRun(saved);
      setMode(saved.mode);
      setTaskId(saved.taskId);
    }
    api<Day>("/api/v1/today", { auth: true })
      .then((d) => setTasks(d.items.filter((i) => i.item.category !== "prayer" && i.item.category !== "sleep")))
      .catch(() => {});
    refreshStats();
  }, [refreshStats]);

  useEffect(() => save(STORE, run), [run]);

  const total = durations[mode] * 60_000;
  const remaining = run ? (run.endAt ? run.endAt - now : run.remaining) : total;
  const ticking = Boolean(run?.endAt);

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [ticking]);

  // Ekran o'chmasin
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (ticking && nav.wakeLock) {
      nav.wakeLock.request("screen").then((l) => (wakeLock.current = l)).catch(() => {});
    }
    return () => {
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [ticking]);

  useEffect(() => {
    document.title = ticking ? `${fmt(remaining)} · ${t(MODE_LABEL[mode])}` : "Dailer";
    return () => {
      document.title = "Dailer";
    };
  }, [ticking, remaining, mode, t]);

  const finish = useCallback(
    async (completed: boolean) => {
      if (!run || finishing.current) return;
      finishing.current = true;
      const ended = Date.now();
      const planned = durations[run.mode];
      const actual = completed ? planned : Math.round((planned * 60_000 - (run.endAt ? run.endAt - ended : run.remaining)) / 60_000);
      setRun(null);
      try {
        if (actual > 0 || completed) {
          await api("/api/v1/pomodoro/sessions", {
            method: "POST",
            auth: true,
            body: {
              kind: run.mode,
              routine_item_id: run.taskId,
              planned_min: planned,
              actual_min: Math.max(0, Math.min(actual, planned)),
              started_at: new Date(run.startedAt).toISOString(),
              ended_at: new Date(ended).toISOString(),
              completed,
              client_id: run.clientId,
            },
          });
        }
      } catch {}
      if (completed) {
        beep();
        const msg = run.mode === "focus" ? t("focus.doneBody") : t("focus.breakDone");
        setToast(msg);
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(run.mode === "focus" ? t("focus.doneTitle") : "Dailer", { body: msg });
          }
        } catch {}
        // Fokusdan keyin tanaffus; har 4-sidan keyin uzun tanaffus
        if (run.mode === "focus") setMode((completedToday + 1) % 4 === 0 ? "long_break" : "short_break");
        else setMode("focus");
      }
      refreshStats();
      finishing.current = false;
    },
    [run, durations, t, completedToday, refreshStats],
  );

  useEffect(() => {
    if (ticking && remaining <= 0) finish(true);
  }, [ticking, remaining, finish]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  function start() {
    const n = Date.now();
    setNow(n);
    if (run && !run.endAt) {
      setRun({ ...run, endAt: n + run.remaining });
      return;
    }
    setRun({ mode, endAt: n + total, remaining: total, startedAt: n, taskId, clientId: crypto.randomUUID() });
  }

  function pause() {
    if (!run?.endAt) return;
    setRun({ ...run, endAt: null, remaining: run.endAt - Date.now() });
  }

  function reset() {
    if (run && run.mode === "focus" && Date.now() - run.startedAt > 60_000) finish(false);
    else setRun(null);
  }

  function setDuration(m: Mode, v: number) {
    const next = { ...durations, [m]: Math.max(1, Math.min(180, v || 1)) };
    setDurations(next);
    save(DURATIONS, next);
  }

  const todayMinutes = useMemo(() => stats?.days.find((d) => d.date === localISODate())?.minutes ?? 0, [stats]);

  return (
    <div className="flex flex-col items-center">
      <h1 className="sr-only">{t("focus.title")}</h1>
      <div className="flex w-full max-w-md gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button
            key={m}
            disabled={Boolean(run)}
            onClick={() => setMode(m)}
            className={`h-10 flex-1 rounded-full px-2 text-xs font-bold transition-colors sm:text-sm ${
              mode === m ? "bg-accent text-accent-ink" : "text-ink-soft"
            } disabled:cursor-not-allowed`}
          >
            {t(MODE_LABEL[m])}
          </button>
        ))}
      </div>

      <div className="relative mt-10">
        <ProgressRing value={run ? 1 - remaining / (durations[run.mode] * 60_000) : 0} size={280} stroke={10}>
          <div className="text-center">
            <p className="font-serif text-7xl tabular-nums tracking-tight">{fmt(remaining)}</p>
            <p className="mt-1 text-sm font-semibold text-ink-faint">{t(MODE_LABEL[run?.mode ?? mode])}</p>
          </div>
        </ProgressRing>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <button
          onClick={reset}
          disabled={!run}
          className="grid h-14 w-14 place-items-center rounded-full ring-1 ring-line transition-transform active:scale-90 disabled:opacity-30"
          aria-label={t("focus.reset")}
          title={t("focus.reset")}
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          onClick={ticking ? pause : start}
          className="grid h-20 w-20 place-items-center rounded-full bg-accent text-accent-ink shadow-soft transition-transform active:scale-90"
          aria-label={ticking ? t("focus.pause") : run ? t("focus.resume") : t("focus.start")}
        >
          {ticking ? <Pause className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8" />}
        </button>
        <button
          onClick={() => finish(true)}
          disabled={!run}
          className="grid h-14 w-14 place-items-center rounded-full ring-1 ring-line transition-transform active:scale-90 disabled:opacity-30"
          aria-label={t("focus.skip")}
          title={t("focus.skip")}
        >
          <SkipForward className="h-5 w-5" />
        </button>
      </div>

      {toast && (
        <p role="status" className="animate-rise mt-6 rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-cream">
          {toast}
        </p>
      )}

      <div className="mt-10 w-full max-w-md space-y-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("focus.task")}</span>
          <select
            className="field"
            value={taskId ?? ""}
            disabled={Boolean(run)}
            onChange={(e) => setTaskId(e.target.value || null)}
          >
            <option value="">{t("focus.noTask")}</option>
            {tasks.map((e) => (
              <option key={e.item.id} value={e.item.id}>
                {e.item.title}
              </option>
            ))}
          </select>
        </label>

        <div className="card grid grid-cols-2 divide-x divide-line p-0">
          <div className="p-5 text-center">
            <p className="font-serif text-3xl">{completedToday}</p>
            <p className="text-xs text-ink-faint">{t("focus.sessions", { n: completedToday })}</p>
          </div>
          <div className="p-5 text-center">
            <p className="font-serif text-3xl">{todayMinutes}</p>
            <p className="text-xs text-ink-faint">{t("focus.minutes", { n: todayMinutes })}</p>
          </div>
        </div>

        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">{t("focus.settings")}</summary>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
              <label key={m} className="block">
                <span className="mb-1.5 block truncate text-xs font-semibold text-ink-faint">{t(MODE_LABEL[m])}</span>
                <input
                  className="field text-center"
                  inputMode="numeric"
                  value={durations[m]}
                  disabled={Boolean(run)}
                  onChange={(e) => setDuration(m, Number(e.target.value.replace(/\D/g, "")))}
                />
              </label>
            ))}
          </div>
        </details>

        <p className="pt-2 text-center font-serif italic text-ink-faint">“{t("focus.quote")}”</p>
      </div>
    </div>
  );
}

export default function FocusPage() {
  return (
    <AppShell>
      <FocusView />
    </AppShell>
  );
}

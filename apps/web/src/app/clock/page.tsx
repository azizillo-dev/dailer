"use client";

import { Maximize, Minimize, Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");
const PREFS = "dailer.clock";
const TIMER = "dailer.clock.timer";
const PRESETS = [5, 15, 30, 60, 120, 180];

type WakeLockSentinelLike = { release: () => Promise<void> };
type Mode = "clock" | "timer";
/** endAt — ishlayotgan bo'lsa tugash vaqti; to'xtatilgan bo'lsa left (ms). */
type Timer = { total: number; endAt: number | null; left: number | null };

function split(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Qisqa signal (WebAudio) — fayl kerak emas. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.28, 0.56].forEach((at) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.25);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {}
}

/**
 * Stol soati va taymer: qop-qora fon, oq raqamlar. Planshet (iPad) yoki yonboshlatilgan
 * telefonda butun ekranni egallaydi; ekran o'chmaydi (Wake Lock), kursor yashirinadi.
 */
export default function ClockPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<Mode>("clock");
  const [h24, setH24] = useState(true);
  const [showSec, setShowSec] = useState(true);
  const [ui, setUi] = useState(true);
  const [full, setFull] = useState(false);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [setup, setSetup] = useState({ h: 0, m: 25 });
  const [ringing, setRinging] = useState(false);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
      if (typeof p.h24 === "boolean") setH24(p.h24);
      if (typeof p.sec === "boolean") setShowSec(p.sec);
      if (p.mode === "timer") setMode("timer");
      if (p.setup) setSetup(p.setup);
      const tm = JSON.parse(localStorage.getItem(TIMER) ?? "null") as Timer | null;
      if (tm) setTimer(tm);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ h24, sec: showSec, mode, setup }));
    } catch {}
  }, [h24, showSec, mode, setup]);
  useEffect(() => {
    try {
      if (timer) localStorage.setItem(TIMER, JSON.stringify(timer));
      else localStorage.removeItem(TIMER);
    } catch {}
  }, [timer]);

  // Soniya boshiga moslab yangilanadi
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  // Taymer tugadi — signal (to'xtatilmaguncha, ko'pi bilan 1 daqiqa)
  useEffect(() => {
    if (timer?.endAt && now && now.getTime() >= timer.endAt) {
      setTimer(null);
      setRinging(true);
    }
  }, [now, timer]);
  useEffect(() => {
    if (!ringing) return;
    beep();
    const id = setInterval(beep, 2000);
    const stop = setTimeout(() => setRinging(false), 60_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [ringing]);

  // Ekran o'chmasin; sahifaga qaytilganda qayta so'raladi
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    const request = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // To'g'ridan-to'g'ri ochilgan bo'lsa, orqaga yo'l yo'q — bugungi sahifaga
  const leave = useCallback(() => (window.history.length > 1 ? router.back() : router.push("/today")), [router]);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
  }, []);

  // Taymer sozlanayotganda boshqaruv yashirinmaydi
  const idleSetup = mode === "timer" && !timer && !ringing;
  const wake = useCallback(() => {
    setUi(true);
    if (hide.current) clearTimeout(hide.current);
    hide.current = setTimeout(() => setUi(false), 3500);
  }, []);
  useEffect(() => {
    wake();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) leave();
      if (e.key.toLowerCase() === "f") toggleFull();
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave, wake, toggleFull]);
  const showUi = ui || idleSetup || ringing;

  if (!now) return <div className="fixed inset-0 bg-black" />;

  const start = (minutes: number) => {
    const total = minutes * 60_000;
    if (total <= 0) return;
    setTimer({ total, endAt: Date.now() + total, left: null });
  };
  const pause = () => timer?.endAt && setTimer({ ...timer, endAt: null, left: timer.endAt - Date.now() });
  const resume = () => timer?.left != null && setTimer({ ...timer, endAt: Date.now() + timer.left, left: null });

  const m = now.getMinutes();
  const shift = { transform: `translate(${((m * 7) % 13) - 6}px, ${((m * 5) % 11) - 5}px)` };
  const remaining = timer ? (timer.endAt ? timer.endAt - now.getTime() : (timer.left ?? 0)) : 0;
  const r = split(remaining);
  const big = "min(21vw, 52vh)";
  const fmtTime = (d: Date) => d.toLocaleTimeString(lang === "uz" ? "uz-Latn-UZ" : lang, { hour: "2-digit", minute: "2-digit", hour12: !h24 });

  return (
    <div
      className={`fixed inset-0 z-50 flex select-none items-center justify-center overflow-hidden bg-black text-white ${showUi ? "" : "cursor-none"}`}
      onMouseMove={wake}
      onClick={wake}
      onDoubleClick={toggleFull}
    >
      {mode === "clock" && (
        <Clock now={now} h24={h24} showSec={showSec} lang={lang} style={shift} />
      )}

      {mode === "timer" && ringing && (
        <button className="flex flex-col items-center gap-6" onClick={() => setRinging(false)}>
          <span className="animate-pulse font-medium tabular-nums leading-none" style={{ fontSize: big, letterSpacing: "-0.04em" }}>
            00:00
          </span>
          <span className="rounded-full bg-white px-6 py-3 text-base font-bold text-black">{t("clock.done")} ✕</span>
        </button>
      )}

      {mode === "timer" && timer && (
        <div className="flex flex-col items-center" style={shift} role="timer" aria-live="off">
          <span className="font-medium tabular-nums leading-none" style={{ fontSize: r.h ? "min(17vw, 46vh)" : big, letterSpacing: "-0.04em", opacity: timer.endAt ? 1 : 0.55 }}>
            {r.h > 0 && `${r.h}:`}
            {pad(r.m)}:{pad(r.s)}
          </span>
          {/* Ingichka progress */}
          <div className="mt-[4vh] h-1 w-[min(60vw,640px)] overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white/70 transition-[width] duration-1000 ease-linear" style={{ width: `${(1 - remaining / timer.total) * 100}%` }} />
          </div>
          <p className="mt-3 text-sm font-semibold text-neutral-500">
            {timer.endAt ? t("clock.endsAt", { time: fmtTime(new Date(timer.endAt)) }) : t("clock.pause")}
          </p>
          <div className={`mt-6 flex gap-3 transition-opacity duration-500 ${showUi ? "opacity-100" : "pointer-events-none opacity-0"}`} onDoubleClick={(e) => e.stopPropagation()}>
            <button onClick={() => setTimer(null)} className="flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold hover:bg-white/20">
              <RotateCcw className="h-4 w-4" /> {t("clock.reset")}
            </button>
            <button onClick={timer.endAt ? pause : resume} className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black">
              {timer.endAt ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {timer.endAt ? t("clock.pause") : t("clock.resume")}
            </button>
          </div>
        </div>
      )}

      {idleSetup && (
        <div className="flex flex-col items-center gap-7" onDoubleClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4 sm:gap-8">
            <Stepper value={setup.h} unit={t("clock.hours")} onChange={(h) => setSetup((s) => ({ ...s, h: Math.max(0, Math.min(23, h)) }))} step={1} />
            <span className="pb-8 text-6xl font-medium text-neutral-600 sm:text-8xl">:</span>
            <Stepper value={setup.m} unit={t("clock.minutes")} onChange={(v) => setSetup((s) => ({ ...s, m: (v + 60) % 60 }))} step={5} />
          </div>
          <div className="flex max-w-xl flex-wrap justify-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setSetup({ h: Math.floor(p / 60), m: p % 60 })}
                className={`h-9 rounded-full px-4 text-sm font-bold ring-1 ${setup.h * 60 + setup.m === p ? "bg-white text-black ring-white" : "text-neutral-300 ring-white/20 hover:ring-white/50"}`}
              >
                {p < 60 ? `${p} ${t("clock.minutes")}` : `${p / 60} ${t("clock.hours")}`}
              </button>
            ))}
          </div>
          <button
            onClick={() => start(setup.h * 60 + setup.m)}
            disabled={setup.h * 60 + setup.m === 0}
            className="flex h-14 items-center gap-2 rounded-full bg-white px-10 text-base font-bold text-black disabled:opacity-30"
          >
            <Play className="h-5 w-5" /> {t("clock.start")}
          </button>
        </div>
      )}

      {/* Yuqori boshqaruv */}
      <div
        className={`absolute inset-x-4 top-4 flex items-center justify-between gap-2 transition-opacity duration-500 ${showUi ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button onClick={leave} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={t("clock.close")} title={t("clock.close")}>
          <X className="h-5 w-5" />
        </button>
        <div className="flex rounded-full bg-white/10 p-1" role="tablist">
          {(["clock", "timer"] as Mode[]).map((md) => (
            <button
              key={md}
              role="tab"
              aria-selected={mode === md}
              onClick={() => setMode(md)}
              className={`h-8 rounded-full px-4 text-sm font-bold transition-colors ${mode === md ? "bg-white text-black" : "text-neutral-300 hover:text-white"}`}
            >
              {t(md === "clock" ? "clock.clock" : "clock.timer")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {mode === "clock" && (
            <>
              <button onClick={() => setH24((v) => !v)} className="hidden h-10 rounded-full bg-white/10 px-4 text-sm font-bold hover:bg-white/20 sm:block">
                {h24 ? "24h" : "12h"}
              </button>
              <button onClick={() => setShowSec((v) => !v)} className="hidden h-10 rounded-full bg-white/10 px-4 text-sm font-bold hover:bg-white/20 sm:block">
                {showSec ? ":ss" : ":—"}
              </button>
            </>
          )}
          <button onClick={toggleFull} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={t("clock.fullscreen")} title={t("clock.fullscreen")}>
            {full ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {!full && mode === "clock" && (
        <p className={`absolute bottom-5 text-xs text-neutral-600 transition-opacity duration-500 ${showUi ? "opacity-100" : "opacity-0"}`}>{t("clock.hint")}</p>
      )}
    </div>
  );
}

function Clock({ now, h24, showSec, lang, style }: { now: Date; h24: boolean; showSec: boolean; lang: string; style: React.CSSProperties }) {
  const hours = h24 ? now.getHours() : now.getHours() % 12 || 12;
  const size = showSec ? "min(21vw, 52vh)" : "min(27vw, 60vh)";
  const date = now.toLocaleDateString(lang === "uz" ? "uz-Latn-UZ" : lang, { weekday: "long", day: "numeric", month: "long" });
  return (
    // OLED izi qolmasligi uchun har daqiqada bir necha piksel siljiydi
    <div className="flex flex-col items-center transition-transform duration-[2000ms]" style={style} role="timer" aria-label={`${pad(hours)}:${pad(now.getMinutes())}`}>
      <div className="flex items-end font-sans tabular-nums leading-none" style={{ letterSpacing: "-0.04em", fontSize: size }}>
        <span className="font-medium">
          {pad(hours)}
          <span className="transition-opacity duration-300" style={{ opacity: now.getSeconds() % 2 ? 0.3 : 1 }}>
            :
          </span>
          {pad(now.getMinutes())}
        </span>
        {(showSec || !h24) && (
          <span className="mb-[0.12em] ml-[0.06em] flex flex-col items-start">
            {!h24 && <span className="text-[0.16em] font-bold text-neutral-500">{now.getHours() < 12 ? "AM" : "PM"}</span>}
            {showSec && <span className="text-[0.3em] font-medium leading-none text-neutral-400">{pad(now.getSeconds())}</span>}
          </span>
        )}
      </div>
      <p className="mt-[2vh] font-semibold capitalize tracking-wider text-neutral-500" style={{ fontSize: "max(14px, min(2.4vw, 4vh))" }}>
        {date}
      </p>
    </div>
  );
}

function Stepper({ value, unit, onChange, step }: { value: number; unit: string; onChange: (v: number) => void; step: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button onClick={() => onChange(value + step)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={`+${step} ${unit}`}>
        <Plus className="h-5 w-5" />
      </button>
      <span className="text-7xl font-medium tabular-nums leading-none sm:text-9xl" style={{ letterSpacing: "-0.04em" }}>
        {pad(value)}
      </span>
      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">{unit}</span>
      <button onClick={() => onChange(value - step)} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={`-${step} ${unit}`}>
        <Minus className="h-5 w-5" />
      </button>
    </div>
  );
}

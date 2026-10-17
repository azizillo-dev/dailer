import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { Maximize, Minus, Pause, Play, Plus, RotateCcw, RotateCw, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, Text, useWindowDimensions, Vibration, View } from "react-native";
import { useI18n } from "@/lib/i18n";
import { prefs } from "@/lib/storage";
import { fonts } from "@/lib/theme";

const pad = (n: number) => String(n).padStart(2, "0");
const PRESETS = [5, 15, 30, 60, 120, 180];
const KEY = "dailer.clock.timer";

type Mode = "clock" | "timer";
/** endAt — ishlayotgan bo'lsa tugash vaqti; to'xtatilgan bo'lsa left (ms). */
type Timer = { total: number; endAt: number | null; left: number | null; notif?: string | null };

const split = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
};

function webBeep() {
  if (Platform.OS !== "web") return;
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
 * Stol soati va taymer: qop-qora fon, oq raqamlar. Butun ekranni egallaydi,
 * telefonda yonboshlab (landscape) ko'rsatiladi, ekran o'chmaydi.
 */
export default function Clock() {
  const { t, lang } = useI18n();
  const { width, height } = useWindowDimensions();
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState<Mode>("clock");
  const [h24, setH24] = useState(true);
  const [showSec, setShowSec] = useState(true);
  const [timer, setTimerState] = useState<Timer | null>(null);
  const [setup, setSetup] = useState({ h: 0, m: 25 });
  const [ringing, setRinging] = useState(false);
  const [ui, setUi] = useState(true);
  const fade = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTimer = useCallback((tm: Timer | null) => {
    setTimerState(tm);
    prefs.set(KEY, JSON.stringify(tm)).catch(() => {});
  }, []);

  useEffect(() => {
    prefs.get(KEY).then((v) => {
      const tm = v ? (JSON.parse(v) as Timer | null) : null;
      if (tm) {
        setTimerState(tm);
        setMode("timer");
      }
    });
  }, []);

  // Soniya boshiga moslab yangilanadi (sakramaydi)
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      id = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    activateKeepAwakeAsync("clock").catch(() => {});
    if (Platform.OS !== "web") ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      deactivateKeepAwake("clock");
      if (Platform.OS !== "web") ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Taymer tugadi
  useEffect(() => {
    if (timer?.endAt && now.getTime() >= timer.endAt) {
      setTimer(null);
      setRinging(true);
    }
  }, [now, timer, setTimer]);
  useEffect(() => {
    if (!ringing) return;
    const ring = () => {
      webBeep();
      if (Platform.OS !== "web") Vibration.vibrate([0, 400, 200, 400]);
    };
    ring();
    const id = setInterval(ring, 2000);
    const stop = setTimeout(() => setRinging(false), 60_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
      Vibration.cancel();
    };
  }, [ringing]);

  // Boshqaruv tugmalari 3 soniyadan keyin yashirinadi
  const showUi = useCallback(() => {
    setUi(true);
    Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== "web" }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 600, useNativeDriver: Platform.OS !== "web" }).start(() => setUi(false));
    }, 3500);
  }, [fade]);
  useEffect(() => {
    showUi();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showUi]);

  // Ilova fonda bo'lsa ham tugaganini bildiradi
  async function scheduleEnd(endAt: number) {
    if (Platform.OS === "web") return null;
    return Notifications.scheduleNotificationAsync({
      content: { title: t("clock.timer"), body: t("clock.done"), sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endAt) },
    }).catch(() => null);
  }
  const cancelEnd = (tm: Timer | null) => {
    if (tm?.notif && Platform.OS !== "web") Notifications.cancelScheduledNotificationAsync(tm.notif).catch(() => {});
  };

  async function start(minutes: number) {
    const total = minutes * 60_000;
    if (total <= 0) return;
    const endAt = Date.now() + total;
    setTimer({ total, endAt, left: null, notif: await scheduleEnd(endAt) });
  }
  function pause() {
    if (!timer?.endAt) return;
    cancelEnd(timer);
    setTimer({ ...timer, endAt: null, left: timer.endAt - Date.now(), notif: null });
  }
  async function resume() {
    if (timer?.left == null) return;
    const endAt = Date.now() + timer.left;
    setTimer({ ...timer, endAt, left: null, notif: await scheduleEnd(endAt) });
  }
  function reset() {
    cancelEnd(timer);
    setTimer(null);
  }

  const landscape = width > height;
  const short = landscape && height < 520;
  const hours = h24 ? now.getHours() : now.getHours() % 12 || 12;
  const big = Math.min(width * (showSec ? 0.2 : 0.27), height * (landscape ? 0.55 : 0.3));
  const date = now.toLocaleDateString(lang === "uz" ? "uz-Latn-UZ" : lang, { weekday: "long", day: "numeric", month: "long" });
  const remaining = timer ? (timer.endAt ? timer.endAt - now.getTime() : (timer.left ?? 0)) : 0;
  const r = split(remaining);
  const timerBig = Math.min(width * (r.h ? 0.16 : 0.2), height * (landscape ? 0.45 : 0.25));
  const setupMode = mode === "timer" && !timer && !ringing;
  const visible = ui || setupMode || ringing;

  // OLED ekran izi qolmasligi uchun har daqiqada bir necha piksel siljiydi
  const m = now.getMinutes();
  const shift = { transform: [{ translateX: ((m * 7) % 13) - 6 }, { translateY: ((m * 5) % 11) - 5 }] };

  async function fullscreen() {
    if (Platform.OS !== "web") return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <Pressable onPress={showUi} style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }} accessibilityLabel="clock">
      <StatusBar hidden />

      {mode === "clock" && (
        <View style={[{ alignItems: "center" }, shift]}>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Text style={[digits, { fontSize: big, lineHeight: big * 1.05 }]}>
              {pad(hours)}
              <Text style={{ opacity: now.getSeconds() % 2 ? 0.35 : 1 }}>:</Text>
              {pad(now.getMinutes())}
            </Text>
            {(showSec || !h24) && (
              <View style={{ marginLeft: big * 0.06, marginBottom: big * 0.14, alignItems: "flex-start" }}>
                {!h24 && <Text style={[digits, { fontSize: big * 0.16, color: "#8a8a8a" }]}>{now.getHours() < 12 ? "AM" : "PM"}</Text>}
                {showSec && <Text style={[digits, { fontSize: big * 0.3, color: "#9a9a9a", lineHeight: big * 0.32 }]}>{pad(now.getSeconds())}</Text>}
              </View>
            )}
          </View>
          <Text style={{ color: "#6b6b6b", fontFamily: fonts.sansSemi, fontSize: Math.max(13, big * 0.1), marginTop: big * 0.04, textTransform: "capitalize", letterSpacing: 1 }}>{date}</Text>
        </View>
      )}

      {mode === "timer" && ringing && (
        <Pressable onPress={() => setRinging(false)} style={{ alignItems: "center", gap: 18 }}>
          <Text style={[digits, { fontSize: timerBig, lineHeight: timerBig * 1.05, opacity: now.getSeconds() % 2 ? 0.4 : 1 }]}>00:00</Text>
          <View style={{ backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11 }}>
            <Text style={{ color: "#000", fontFamily: fonts.sansBold, fontSize: 15 }}>{t("clock.done")} ✕</Text>
          </View>
        </Pressable>
      )}

      {mode === "timer" && timer && (
        <View style={[{ alignItems: "center" }, shift]}>
          <Text style={[digits, { fontSize: timerBig, lineHeight: timerBig * 1.05, opacity: timer.endAt ? 1 : 0.55 }]}>
            {r.h > 0 ? `${r.h}:` : ""}
            {pad(r.m)}:{pad(r.s)}
          </Text>
          <View style={{ marginTop: 14, height: 4, width: Math.min(width * 0.6, 560), borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
            <View style={{ height: 4, width: `${(1 - remaining / timer.total) * 100}%`, backgroundColor: "rgba(255,255,255,0.75)" }} />
          </View>
          <Text style={{ color: "#6b6b6b", fontFamily: fonts.sansSemi, fontSize: 13, marginTop: 10 }}>
            {timer.endAt
              ? t("clock.endsAt", { time: new Date(timer.endAt).toLocaleTimeString(lang === "uz" ? "uz-Latn-UZ" : lang, { hour: "2-digit", minute: "2-digit", hour12: !h24 }) })
              : t("clock.pause")}
          </Text>
          <Animated.View style={{ flexDirection: "row", gap: 10, marginTop: 18, opacity: visible ? 1 : fade }} pointerEvents={visible ? "auto" : "none"}>
            <Pill onPress={reset} icon={<RotateCcw color="#fff" size={15} />} label={t("clock.reset")} />
            <Pill
              onPress={timer.endAt ? pause : resume}
              icon={timer.endAt ? <Pause color="#000" size={15} /> : <Play color="#000" size={15} />}
              label={timer.endAt ? t("clock.pause") : t("clock.resume")}
              light
            />
          </Animated.View>
        </View>
      )}

      {setupMode && (
        // Past ekranda (telefon yonboshlab) — ikki ustun: chapda raqamlar, o'ngda tayyor variantlar
        <View style={short ? { flexDirection: "row", alignItems: "center", gap: 36, marginTop: 30 } : { alignItems: "center", gap: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <Stepper value={setup.h} unit={t("clock.hours")} step={1} onChange={(h) => setSetup((s) => ({ ...s, h: Math.max(0, Math.min(23, h)) }))} size={short ? 60 : 72} />
            <Text style={[digits, { fontSize: 48, color: "#555", marginBottom: 20 }]}>:</Text>
            <Stepper value={setup.m} unit={t("clock.minutes")} step={5} onChange={(v) => setSetup((s) => ({ ...s, m: (v + 60) % 60 }))} size={short ? 60 : 72} />
          </View>
          <View style={{ alignItems: "center", gap: short ? 16 : 22 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: short ? 300 : 460 }}>
            {PRESETS.map((p) => {
              const on = setup.h * 60 + setup.m === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setSetup({ h: Math.floor(p / 60), m: p % 60 })}
                  style={{ height: 32, paddingHorizontal: 13, borderRadius: 16, justifyContent: "center", backgroundColor: on ? "#fff" : "transparent", borderWidth: 1, borderColor: on ? "#fff" : "rgba(255,255,255,0.22)" }}
                >
                  <Text style={{ color: on ? "#000" : "#ccc", fontFamily: fonts.sansBold, fontSize: 12.5 }}>{p < 60 ? `${p} ${t("clock.minutes")}` : `${p / 60} ${t("clock.hours")}`}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pill onPress={() => start(setup.h * 60 + setup.m)} icon={<Play color="#000" size={16} />} label={t("clock.start")} light big disabled={setup.h * 60 + setup.m === 0} />
          </View>
        </View>
      )}

      {visible && (
        <Animated.View style={{ position: "absolute", top: 14, left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: setupMode || ringing ? 1 : fade }}>
          <Round label={t("clock.close")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
            <X color="#fff" size={18} />
          </Round>
          <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, padding: 3 }}>
            {(["clock", "timer"] as Mode[]).map((md) => (
              <Pressable key={md} onPress={() => setMode(md)} accessibilityRole="tab" accessibilityState={{ selected: mode === md }} style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: mode === md ? "#fff" : "transparent" }}>
                <Text style={{ color: mode === md ? "#000" : "#ccc", fontFamily: fonts.sansBold, fontSize: 12.5 }}>{t(md === "clock" ? "clock.clock" : "clock.timer")}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {mode === "clock" && (
              <>
                <Chip label={h24 ? "24h" : "12h"} onPress={() => setH24((v) => !v)} />
                <Chip label={showSec ? ":ss" : ":—"} onPress={() => setShowSec((v) => !v)} />
              </>
            )}
            {Platform.OS === "web" ? (
              <Round label={t("clock.fullscreen")} onPress={fullscreen}>
                <Maximize color="#fff" size={16} />
              </Round>
            ) : (
              <Round
                label={t("clock.rotate")}
                onPress={() => ScreenOrientation.lockAsync(landscape ? ScreenOrientation.OrientationLock.PORTRAIT_UP : ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})}
              >
                <RotateCw color="#fff" size={16} />
              </Round>
            )}
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

const digits = { color: "#fff", fontFamily: fonts.sans, fontVariant: ["tabular-nums" as const], letterSpacing: -2, includeFontPadding: false };

function Round({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
      {children}
    </Pressable>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ height: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontFamily: fonts.sansBold, fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
}

function Pill({ onPress, icon, label, light, big, disabled }: { onPress: () => void; icon: React.ReactNode; label: string; light?: boolean; big?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ height: big ? 48 : 42, paddingHorizontal: big ? 28 : 18, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: light ? "#fff" : "rgba(255,255,255,0.1)", opacity: disabled ? 0.3 : 1 }}
    >
      {icon}
      <Text style={{ color: light ? "#000" : "#fff", fontFamily: fonts.sansBold, fontSize: big ? 15 : 13 }}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ value, unit, onChange, step, size }: { value: number; unit: string; onChange: (v: number) => void; step: number; size: number }) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Round label={`+${step} ${unit}`} onPress={() => onChange(value + step)}>
        <Plus color="#fff" size={17} />
      </Round>
      <Text style={[digits, { fontSize: size, lineHeight: size * 1.08 }]}>{pad(value)}</Text>
      <Text style={{ color: "#777", fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{unit}</Text>
      <Round label={`-${step} ${unit}`} onPress={() => onChange(value - step)}>
        <Minus color="#fff" size={17} />
      </Round>
    </View>
  );
}

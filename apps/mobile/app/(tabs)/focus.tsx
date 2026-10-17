import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { Pause, Play, RotateCcw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Press, Ring, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fonts, radius, usePalette } from "@/lib/theme";

type Mode = "focus" | "short_break" | "long_break";
const MIN: Record<Mode, number> = { focus: 25, short_break: 5, long_break: 15 };
const LABEL = { focus: "focus.focus", short_break: "focus.short", long_break: "focus.long" } as const;

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function Focus() {
  const { t } = useI18n();
  const c = usePalette();
  const [mode, setMode] = useState<Mode>("focus");
  const [endAt, setEndAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [left, setLeft] = useState(MIN.focus * 60_000);
  const [now, setNow] = useState(Date.now());
  const [doneCount, setDoneCount] = useState(0);
  const [todayMin, setTodayMin] = useState(0);
  const endNotif = useRef<string | null>(null);

  const total = MIN[mode] * 60_000;
  const remaining = endAt ? endAt - now : left;

  useEffect(() => {
    api<{ days: { date: string; minutes: number }[] }>("/api/v1/pomodoro/stats", { auth: true })
      .then((r) => setTodayMin(r.days[r.days.length - 1]?.minutes ?? 0))
      .catch(() => {});
  }, [doneCount]);

  useEffect(() => {
    if (!endAt) return;
    activateKeepAwakeAsync().catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(id);
      deactivateKeepAwake();
    };
  }, [endAt]);

  useEffect(() => {
    if (endAt && remaining <= 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, endAt]);

  async function start() {
    const n = Date.now();
    const end = n + (endAt ? remaining : left);
    setEndAt(end);
    setStartedAt((s) => s ?? n);
    setNow(n);
    // Ilova fonda bo'lsa ham tugaganini bildiradi
    if (Platform.OS !== "web") {
      endNotif.current = await Notifications.scheduleNotificationAsync({
        content: { title: "Dailer", body: t("focus.done"), sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(end) },
      }).catch(() => null);
    }
  }

  async function pause() {
    if (!endAt) return;
    setLeft(endAt - Date.now());
    setEndAt(null);
    if (endNotif.current) await Notifications.cancelScheduledNotificationAsync(endNotif.current).catch(() => {});
  }

  async function finish() {
    const started = startedAt ?? Date.now() - total;
    setEndAt(null);
    setStartedAt(null);
    setLeft(MIN[mode === "focus" ? "short_break" : "focus"] * 60_000);
    await api("/api/v1/pomodoro/sessions", {
      method: "POST",
      auth: true,
      body: {
        kind: mode,
        planned_min: MIN[mode],
        actual_min: MIN[mode],
        started_at: new Date(started).toISOString(),
        ended_at: new Date().toISOString(),
        completed: true,
      },
    }).catch(() => {});
    if (mode === "focus") {
      setDoneCount((n) => n + 1);
      setMode((doneCount + 1) % 4 === 0 ? "long_break" : "short_break");
    } else setMode("focus");
  }

  function reset() {
    pause();
    setStartedAt(null);
    setLeft(MIN[mode] * 60_000);
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.full, padding: 3 }}>
        {(Object.keys(MIN) as Mode[]).map((m) => (
          <Press
            key={m}
            onPress={() => {
              if (endAt) return;
              setMode(m);
              setLeft(MIN[m] * 60_000);
            }}
            style={{ flex: 1, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: mode === m ? c.accent : "transparent" }}
          >
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: mode === m ? c.accentInk : c.inkSoft }}>{t(LABEL[m])}</Text>
          </Press>
        ))}
      </View>

      <View style={{ alignItems: "center", marginTop: 24 }}>
        <Ring value={1 - remaining / total} size={220} stroke={8}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 48, color: c.ink }}>{fmt(remaining)}</Text>
          <Text variant="faint">{t(LABEL[mode])}</Text>
        </Ring>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 18, marginTop: 20 }}>
        <Press onPress={reset} accessibilityLabel="reset" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }}>
          <RotateCcw color={c.ink} size={17} />
        </Press>
        <Press
          onPress={endAt ? pause : start}
          accessibilityLabel={endAt ? "pause" : "start"}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}
        >
          {endAt ? <Pause color={c.accentInk} size={24} /> : <Play color={c.accentInk} size={24} />}
        </Press>
        <View style={{ width: 44 }} />
      </View>
      <Text variant="soft" style={{ textAlign: "center", marginTop: 12 }}>
        {t("focus.today", { n: todayMin })}
      </Text>
    </Screen>
  );
}

import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Field, Message, Press, Screen, Text } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { ensurePermission, rescheduleWeek, setupCategories } from "@/lib/notifications";
import { fonts, radius, usePalette } from "@/lib/theme";

const TYPES = ["university_student", "school_pupil", "worker", "other"] as const;
const INTERESTS: Record<string, Record<string, string>> = {
  reading: { uz: "Kitob", ru: "Чтение", en: "Reading" },
  sport: { uz: "Sport", ru: "Спорт", en: "Sport" },
  language: { uz: "Chet tili", ru: "Язык", en: "Language" },
  quran: { uz: "Qur'on", ru: "Коран", en: "Quran" },
  programming: { uz: "Dasturlash", ru: "Программирование", en: "Coding" },
  math: { uz: "Matematika", ru: "Математика", en: "Math" },
};

type PlanItem = { title: string; start_time: string | null; duration_min: number | null; [k: string]: unknown };

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const c = usePalette();
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: radius.full,
        backgroundColor: on ? c.accent : c.surface,
        borderWidth: 1,
        borderColor: on ? c.accent : c.line,
      }}
    >
      <Text style={{ color: on ? c.accentInk : c.ink, fontFamily: fonts.sansSemi, fontSize: 14 }}>{label}</Text>
    </Press>
  );
}

const timeOk = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export default function Onboarding() {
  const { t, lang } = useI18n();
  const c = usePalette();
  const { refreshMe } = useAuth();
  const [type, setType] = useState<string | null>(null);
  const [birth, setBirth] = useState("");
  const [wake, setWake] = useState("05:00");
  const [sleep, setSleep] = useState("23:00");
  const [prays, setPrays] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = type && Number(birth) > 1930 && timeOk(wake) && timeOk(sleep) && prays !== null && goal.trim().length >= 3;

  async function locate() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    setCoords({ latitude: Math.round(pos.coords.latitude * 1e4) / 1e4, longitude: Math.round(pos.coords.longitude * 1e4) / 1e4 });
  }

  async function submit() {
    setError("");
    setBusy(true);
    try {
      await api("/api/v1/me/onboarding", {
        method: "POST",
        auth: true,
        body: {
          user_type: type,
          birth_year: Number(birth),
          wake_time: wake,
          sleep_time: sleep,
          evening_summary_time: "21:30",
          prays,
          interests,
          main_goal: goal.trim(),
          language: lang,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent",
          ...(coords ?? { latitude: 41.2995, longitude: 69.2401, city: "Toshkent" }),
        },
      });
      setPlan(await api<PlanItem[]>("/api/v1/routine/starter-plan", { auth: true }));
    } catch (e) {
      setError(errorText(e, t("common.error"), t("common.network")));
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    setBusy(true);
    try {
      if (plan?.length) await api("/api/v1/routine-items/bulk", { method: "POST", auth: true, body: { items: plan, replace: true } });
      if (await ensurePermission()) {
        await setupCategories();
        await rescheduleWeek();
      }
      await refreshMe();
      router.replace("/today");
    } catch (e) {
      setError(errorText(e, t("common.error"), t("common.network")));
      setBusy(false);
    }
  }

  if (plan) {
    return (
      <Screen>
        <Text variant="title">{t("ob.finish")}</Text>
        {plan.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
            <Text variant="faint" style={{ width: 46, fontFamily: fonts.sansBold }}>
              {(p.start_time ?? "").slice(0, 5)}
            </Text>
            <Text style={{ flex: 1, fontFamily: fonts.sansSemi }}>{p.title}</Text>
            {p.duration_min ? <Text variant="faint">{p.duration_min} {t("common.min")}</Text> : null}
          </View>
        ))}
        <Message kind="error">{error}</Message>
        <Button title={t("common.next")} onPress={accept} loading={busy} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="eyebrow">Dailer</Text>
      <Text variant="title">{t("ob.title")}</Text>

      <Card style={{ gap: 12 }}>
        <Text variant="h2">{t("ob.who")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((x) => (
            <Chip key={x} on={type === x} label={t(`ob.who.${x}` as MessageKey)} onPress={() => setType(x)} />
          ))}
        </View>
        <Field label={t("ob.birth")} value={birth} onChangeText={(v) => setBirth(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" placeholder="2005" />
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t("ob.wake")} value={wake} onChangeText={setWake} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t("ob.sleep")} value={sleep} onChangeText={setSleep} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </View>
        <Text variant="h2">{t("ob.pray")}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip on={prays === true} label={t("ob.yes")} onPress={() => setPrays(true)} />
          <Chip on={prays === false} label={t("ob.no")} onPress={() => setPrays(false)} />
        </View>
        <Button title={coords ? "✓ " + t("ob.location") : t("ob.location")} kind="ghost" onPress={locate} />
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(INTERESTS).map(([k, l]) => (
            <Chip
              key={k}
              on={interests.includes(k)}
              label={l[lang] ?? l.uz}
              onPress={() => setInterests((x) => (x.includes(k) ? x.filter((i) => i !== k) : [...x, k]))}
            />
          ))}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={{ fontFamily: fonts.serifItalic, color: c.highlight, fontSize: 16 }}>“{t("motto")}”</Text>
        <Text variant="h2">{t("ob.goal")}</Text>
        <Field value={goal} onChangeText={setGoal} multiline maxLength={1000} />
      </Card>

      <Message kind="error">{error}</Message>
      <Button title={t("ob.finish")} onPress={submit} loading={busy} disabled={!ready} />
    </Screen>
  );
}

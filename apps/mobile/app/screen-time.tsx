import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight, Lightbulb, Minus, Plus, ShieldCheck, Smartphone, TrendingDown, TrendingUp } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { Bar, Button, Card, IconButton, Press, Screen, SectionTitle, Segment, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { autoSupported, fmtMinutes, hasPermission, openPermissionSettings, syncScreenTime } from "@/lib/screenTime";
import { fonts, radius, usePalette } from "@/lib/theme";

type Period = "week" | "month";
type Summary = {
  period: Period;
  start: string;
  end: string;
  days: { date: string; total_min: number | null; pickups: number | null; source: string | null; future: boolean }[];
  total_min: number;
  avg_min: number | null;
  delta_pct: number | null;
  avg_pickups: number | null;
  top_apps: { id: string; name: string; minutes: number }[];
  limit_min: number | null;
  days_over_limit: number;
  best_day: string | null;
  worst_day: string | null;
  insight: { threshold_min: number; low_score: number; high_score: number; diff: number } | null;
};

const LIMITS = [60, 120, 180, 240];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function ScreenTime() {
  const { t, lang } = useI18n();
  const c = usePalette();
  const units = { h: t("st.h"), m: t("st.m") };
  const locale = lang === "uz" ? "uz-Latn-UZ" : lang;
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Summary | null>(null);
  const [perm, setPerm] = useState(hasPermission());
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Summary>(`/api/v1/screen-time?period=${period}&offset=${offset}`, { auth: true }));
    } catch {}
  }, [period, offset]);

  useFocusEffect(
    useCallback(() => {
      syncScreenTime().catch(() => {}).finally(load);
    }, [load]),
  );

  // Sozlamalardan ruxsat berib qaytganda — darhol yig'ib olamiz
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active" || !autoSupported) return;
      const ok = hasPermission();
      setPerm(ok);
      if (ok) syncScreenTime(true).then(load).catch(() => {});
    });
    return () => sub.remove();
  }, [load]);

  async function setLimit(v: number | null) {
    await api("/api/v1/screen-time/limit", { method: "PUT", auth: true, body: { limit_min: v } }).catch(() => {});
    load();
  }

  const max = Math.max(60, data?.limit_min ?? 0, ...(data?.days.map((d) => d.total_min ?? 0) ?? []));
  const H = 120;
  const sel = data?.days.find((d) => d.date === selected);
  const rangeLabel = data
    ? period === "week"
      ? `${new Date(`${data.start}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${new Date(`${data.end}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })}`
      : new Date(`${data.start}T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" })
    : "";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton icon={ChevronLeft} label="←" onPress={() => (router.canGoBack() ? router.back() : router.replace("/stats"))} />
        <Text variant="title" style={{ flex: 1 }}>
          {t("st.title")}
        </Text>
      </View>

      {autoSupported && !perm && (
        <Card style={{ gap: 10, borderColor: c.caramel }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Smartphone color={c.highlight} size={18} />
            <Text variant="h3" style={{ flex: 1 }}>
              {t("st.permTitle")}
            </Text>
          </View>
          <Text variant="soft">{t("st.permText")}</Text>
          <Button title={t("st.permBtn")} icon={ShieldCheck} size="sm" onPress={openPermissionSettings} style={{ alignSelf: "flex-start" }} />
        </Card>
      )}

      <Segment<Period>
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setOffset(0);
          setSelected(null);
        }}
        options={[
          { value: "week", label: t("st.week") },
          { value: "month", label: t("st.month") },
        ]}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon={ChevronLeft} label="prev" size={30} onPress={() => setOffset((o) => Math.max(-24, o - 1))} />
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, textTransform: "capitalize" }}>{rangeLabel}</Text>
        <IconButton icon={ChevronRight} label="next" size={30} disabled={offset >= 0} onPress={() => setOffset((o) => Math.min(0, o + 1))} />
      </View>

      {data && (
        <>
          {/* Asosiy raqam */}
          <Card style={{ gap: 8 }}>
            <Text variant="eyebrow">{t("st.avg")}</Text>
            <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: c.ink }}>{fmtMinutes(data.avg_min, units)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {data.delta_pct != null && data.delta_pct !== 0 && (
                <Chip
                  icon={data.delta_pct < 0 ? <TrendingDown color={c.success} size={12} /> : <TrendingUp color={c.danger} size={12} />}
                  text={`${t(data.delta_pct < 0 ? "st.less" : "st.more", { n: Math.abs(data.delta_pct) })} · ${t("st.vsPrev")}`}
                  color={data.delta_pct < 0 ? c.success : c.danger}
                />
              )}
              <Chip text={`${t("st.total")}: ${fmtMinutes(data.total_min, units)}`} />
              {data.avg_pickups != null && <Chip text={`${data.avg_pickups} ${t("st.pickups")}`} />}
            </View>
          </Card>

          {/* Kunlar grafigi; chegara — chiziq */}
          <Card>
            <View style={{ height: H, flexDirection: "row", alignItems: "flex-end", gap: period === "week" ? 8 : 2 }}>
              {data.limit_min != null && (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: 0, right: 0, bottom: (data.limit_min / max) * H, borderTopWidth: 1, borderStyle: "dashed", borderColor: c.danger, opacity: 0.6 }}
                />
              )}
              {data.days.map((d) => {
                const over = data.limit_min != null && (d.total_min ?? 0) > data.limit_min;
                const on = d.date === selected;
                return (
                  <Press
                    key={d.date}
                    haptic={false}
                    disabled={d.future}
                    onPress={() => setSelected(on ? null : d.date)}
                    style={{ flex: 1, height: H, justifyContent: "flex-end", alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: period === "week" ? "62%" : "80%",
                        height: d.total_min == null ? 3 : Math.max(4, (d.total_min / max) * H),
                        borderRadius: period === "week" ? 4 : 2,
                        backgroundColor: d.total_min == null ? c.line : over ? c.danger : on ? c.highlight : c.caramel,
                        opacity: selected && !on ? 0.45 : 1,
                      }}
                    />
                  </Press>
                );
              })}
            </View>
            {period === "week" && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                {data.days.map((d) => (
                  <Text key={d.date} variant="faint" style={{ flex: 1, textAlign: "center", fontFamily: fonts.sansBold, fontSize: 10, textTransform: "capitalize" }}>
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString(locale, { weekday: "short" }).slice(0, 2)}
                  </Text>
                ))}
              </View>
            )}
            <Text variant="faint" style={{ marginTop: 8, textAlign: "center" }}>
              {sel
                ? `${new Date(`${sel.date}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}: ${fmtMinutes(sel.total_min, units)}`
                : data.days_over_limit > 0
                  ? t("st.overLimit", { n: data.days_over_limit })
                  : data.avg_min == null
                    ? t("st.empty")
                    : autoSupported && perm
                      ? t("st.auto")
                      : ""}
            </Text>
          </Card>

          {data.insight && (
            <View style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: c.accentSoft }}>
              <Lightbulb color={c.highlight} size={16} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
                {t("st.insight", { t: fmtMinutes(data.insight.threshold_min, units), low: data.insight.low_score, high: data.insight.high_score })}
              </Text>
            </View>
          )}

          {(!autoSupported || !perm) && <ManualEntry onSaved={load} />}

          {data.top_apps.length > 0 && (
            <>
              <SectionTitle title={t("st.topApps")} />
              <Card padded={false}>
                {data.top_apps.map((a, i) => (
                  <View key={a.id} style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 5, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5 }} numberOfLines={1}>
                        {a.name}
                      </Text>
                      <Text variant="faint" style={{ fontFamily: fonts.sansBold }}>
                        {fmtMinutes(a.minutes, units)}
                      </Text>
                    </View>
                    <Bar value={a.minutes / data.top_apps[0].minutes} height={4} />
                  </View>
                ))}
              </Card>
            </>
          )}

          <SectionTitle title={t("st.limit")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[null, ...LIMITS].map((v) => {
              const on = data.limit_min === v;
              return (
                <Press
                  key={String(v)}
                  onPress={() => setLimit(v)}
                  style={{ paddingHorizontal: 14, height: 32, justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : "transparent" }}
                >
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: on ? c.accentInk : c.inkSoft }}>{v == null ? t("st.limitOff") : fmtMinutes(v, units)}</Text>
                </Press>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

function Chip({ text, icon, color }: { text: string; icon?: React.ReactNode; color?: string }) {
  const c = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surface2, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 }}>
      {icon}
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11.5, color: color ?? c.inkSoft }}>{text}</Text>
    </View>
  );
}

/** iPhone/web (yoki ruxsat berilmagan) — vaqtni qo'lda kiritish. */
function ManualEntry({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const c = usePalette();
  const today = iso(new Date());
  const yesterday = iso(new Date(Date.now() - 86_400_000));
  const [day, setDay] = useState(today);
  const [h, setH] = useState(2);
  const [m, setM] = useState(0);
  const [saved, setSaved] = useState(false);

  async function save() {
    await api("/api/v1/screen-time/days", { method: "PUT", auth: true, body: { source: "manual", days: [{ date: day, total_min: h * 60 + m }] } }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved();
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text variant="h3">{t("st.manualTitle")}</Text>
      <Segment
        value={day}
        onChange={setDay}
        options={[
          { value: today, label: t("st.today") },
          { value: yesterday, label: t("st.yesterday") },
        ]}
      />
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 18 }}>
        <Step value={h} unit={t("st.h")} onChange={(v) => setH(Math.max(0, Math.min(23, v)))} step={1} />
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: c.inkFaint }}>:</Text>
        <Step value={m} unit={t("st.m")} onChange={(v) => setM((v + 60) % 60)} step={5} />
      </View>
      <Button title={saved ? t("st.saved") : t("common.save")} size="sm" onPress={save} />
      <Text variant="faint">{t("st.manualHint")}</Text>
    </Card>
  );
}

function Step({ value, unit, onChange, step }: { value: number; unit: string; onChange: (v: number) => void; step: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <IconButton icon={Minus} label={`-${step}`} size={30} onPress={() => onChange(value - step)} />
      <View style={{ alignItems: "center", minWidth: 44 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28 }}>{String(value).padStart(2, "0")}</Text>
        <Text variant="faint">{unit}</Text>
      </View>
      <IconButton icon={Plus} label={`+${step}`} size={30} onPress={() => onChange(value + step)} />
    </View>
  );
}

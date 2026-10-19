import { Check, Flame, TrendingDown, TrendingUp } from "lucide-react-native";
import { View } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { Card, Text } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { itemIcon } from "@/lib/icons";
import { fonts, radius, usePalette } from "@/lib/theme";

type CellState = "off" | "future" | "open" | "done" | "partial" | "missed" | "excused";
export type WeekGridData = {
  week_start: string;
  rows: {
    item_id: string;
    title: string;
    icon: string;
    cells: { date: string; state: CellState; progress: number | null }[];
    done: number;
    scheduled: number;
    unit: string | null;
    value: number | null;
    value_target: number | null;
    streak: number;
  }[];
  completion: number | null;
  checkins: number;
  prev_checkins: number;
  checkins_delta_pct: number | null;
  perfect_days: number;
  best_streak: { title: string; days: number } | null;
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const DAYS: Record<string, string[]> = {
  uz: ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
  en: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

/** ✓ — bajarildi, halqa — qisman/miqdor, bo'sh doira — o'tkazildi, nuqta — rejada yo'q. */
function Cell({ state, progress }: { state: CellState; progress: number | null }) {
  const c = usePalette();
  const S = 26;
  if (state === "off") return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.line }} />;
  if (state === "done")
    return (
      <View style={{ width: S, height: S, borderRadius: S / 2, backgroundColor: c.success, alignItems: "center", justifyContent: "center" }}>
        <Check color="#fff" size={15} strokeWidth={3} />
      </View>
    );
  const r = 10.5;
  const len = 2 * Math.PI * r;
  const p = state === "partial" || (progress != null && progress > 0) ? (progress ?? 0.5) : 0;
  return (
    <Svg width={S} height={S} viewBox="0 0 26 26" style={{ opacity: state === "future" ? 0.4 : 1 }}>
      <Circle cx={13} cy={13} r={r} fill="none" stroke={state === "open" ? c.highlight : c.line} strokeWidth={2} strokeDasharray={state === "open" ? "3 3" : undefined} />
      {p > 0 && (
        <Circle
          cx={13}
          cy={13}
          r={r}
          fill="none"
          stroke={c.success}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray={`${len}`}
          strokeDashoffset={len * (1 - p)}
          transform="rotate(-90 13 13)"
        />
      )}
      {state === "excused" && (
        <SvgText x={13} y={16.5} fontSize={9} fontWeight="700" fill={c.inkFaint} textAnchor="middle">
          U
        </SvgText>
      )}
    </Svg>
  );
}

/** Haftalik jadval: har vazifa — tepada nom va natija, pastda 7 kun. */
export function WeekGrid({ data }: { data: WeekGridData }) {
  const { t, lang } = useI18n();
  const c = usePalette();
  const days = DAYS[lang] ?? DAYS.uz;
  const delta = data.checkins_delta_pct;

  return (
    <Card style={{ gap: 4 }}>
      <Text variant="h3">{t("grid.title")}</Text>
      <View style={{ flexDirection: "row", marginTop: 6 }}>
        {days.map((d) => (
          <Text key={d} variant="faint" style={{ flex: 1, textAlign: "center", fontFamily: fonts.sansBold, fontSize: 10 }}>
            {d}
          </Text>
        ))}
      </View>
      {data.rows.length === 0 && <Text variant="soft">{t("grid.empty")}</Text>}
      {data.rows.map((r) => {
        const measured = r.value_target != null;
        const complete = measured ? (r.value ?? 0) >= (r.value_target ?? 0) : r.scheduled > 0 && r.done >= r.scheduled;
        const Icon = itemIcon(r.icon);
        return (
          <View key={r.item_id} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 8, gap: 7 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Icon color={c.highlight} size={12} />
              </View>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: 13 }}>
                {r.title}
              </Text>
              {r.streak >= 3 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                  <Flame color={c.highlight} size={11} />
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: c.highlight }}>{r.streak}</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 12.5, color: complete ? c.success : c.ink }}>
                {measured ? `${fmt(r.value ?? 0)}/${fmt(r.value_target ?? 0)} ${r.unit ?? ""}` : `${r.done}/${r.scheduled}${complete ? " ✓" : ""}`}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              {r.cells.map((cell) => (
                <View key={cell.date} style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 26 }}>
                  <Cell state={cell.state} progress={cell.progress} />
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12, marginTop: 4 }}>
        <Stat value={data.completion == null ? "–" : `${Math.round(data.completion)}%`} label={t("grid.completion")} color={c.success} />
        <Stat value={fmt(data.checkins)} label={t("grid.checkins")} />
        <Stat value={data.best_streak ? `${data.best_streak.days} ${t("grid.days")}` : "–"} label={t("grid.bestStreak")} color={c.highlight} />
        <Stat value={String(data.perfect_days)} label={t("grid.perfect")} />
      </View>
      {delta != null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, padding: 8, borderRadius: radius.md, backgroundColor: c.surface2 }}>
          {delta >= 0 ? <TrendingUp color={c.success} size={13} /> : <TrendingDown color={c.danger} size={13} />}
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 12, color: delta >= 0 ? c.success : c.danger }}>
            {t(delta >= 0 ? "grid.ahead" : "grid.behind", { n: Math.abs(delta) })}
          </Text>
        </View>
      )}
    </Card>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  const c = usePalette();
  return (
    <View style={{ width: "50%" }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: color ?? c.ink }}>{value}</Text>
      <Text variant="faint">{label}</Text>
    </View>
  );
}

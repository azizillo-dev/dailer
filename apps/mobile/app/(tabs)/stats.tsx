import { useFocusEffect } from "expo-router";
import { Flame, TrendingDown, TrendingUp } from "lucide-react-native";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Card, Ring, Screen, SectionTitle, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fonts, radius, usePalette } from "@/lib/theme";

type Weekly = {
  days: { date: string; score: number | null }[];
  total: { score: number | null };
  delta: number | null;
  categories: { category: string; score: number | null; done: number; planned: number }[];
  streak: { current: number; longest: number };
};

const CAT: Record<string, Record<string, string>> = {
  prayer: { uz: "Namoz", ru: "Намаз", en: "Prayer" },
  reading: { uz: "Kitob", ru: "Чтение", en: "Reading" },
  sport: { uz: "Sport", ru: "Спорт", en: "Sport" },
  study: { uz: "O'qish", ru: "Учёба", en: "Study" },
  language: { uz: "Til", ru: "Язык", en: "Language" },
  quran: { uz: "Qur'on", ru: "Коран", en: "Quran" },
  dhikr: { uz: "Zikr", ru: "Зикр", en: "Dhikr" },
  sleep: { uz: "Uyqu", ru: "Сон", en: "Sleep" },
  health: { uz: "Salomatlik", ru: "Здоровье", en: "Health" },
  work: { uz: "Ish", ru: "Работа", en: "Work" },
  custom: { uz: "Boshqa", ru: "Другое", en: "Other" },
};

export default function Stats() {
  const { t, lang } = useI18n();
  const c = usePalette();
  const [d, setD] = useState<Weekly | null>(null);

  useFocusEffect(
    useCallback(() => {
      api<Weekly>("/api/v1/stats/weekly", { auth: true }).then(setD).catch(() => {});
    }, []),
  );

  const H = 92;
  const locale = lang === "uz" ? "uz-Latn-UZ" : lang;
  return (
    <Screen>
      <Text variant="title">{t("stats.title")}</Text>
      {d && (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Card style={{ flex: 1, gap: 2 }}>
              <Text variant="faint">{t("stats.score")}</Text>
              <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: c.ink }}>{d.total.score == null ? "–" : `${Math.round(d.total.score)}%`}</Text>
              {d.delta != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {d.delta >= 0 ? <TrendingUp color={c.success} size={12} /> : <TrendingDown color={c.danger} size={12} />}
                  <Text style={{ color: d.delta >= 0 ? c.success : c.danger, fontFamily: fonts.sansBold, fontSize: 11 }}>
                    {Math.abs(d.delta)}% <Text variant="faint">{t("stats.vsLast")}</Text>
                  </Text>
                </View>
              )}
            </Card>
            <Card style={{ flex: 1, gap: 2 }}>
              <Text variant="faint">{t("stats.streak")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Flame color={c.caramel} size={20} />
                <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: c.ink }}>{d.streak.current}</Text>
              </View>
              <Text variant="faint">max {d.streak.longest}</Text>
            </Card>
          </View>

          <Card>
            <View style={{ height: H, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              {d.days.map((x) => (
                <View key={x.date} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: H }}>
                  <View
                    style={{
                      width: "62%",
                      height: x.score == null ? 3 : Math.max(4, (x.score / 100) * H),
                      backgroundColor: x.score == null ? c.line : c.caramel,
                      borderRadius: 4,
                    }}
                  />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              {d.days.map((x) => (
                <Text key={x.date} variant="faint" style={{ flex: 1, textAlign: "center", fontFamily: fonts.sansBold, fontSize: 10, textTransform: "capitalize" }}>
                  {new Date(`${x.date}T12:00:00`).toLocaleDateString(locale, { weekday: "short" }).slice(0, 2)}
                </Text>
              ))}
            </View>
          </Card>

          <SectionTitle title={t("stats.byCategory")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {d.categories.map((cat) => (
              <View
                key={cat.category}
                style={{ width: "31.6%", alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}
              >
                <Ring value={(cat.score ?? 0) / 100} size={50} stroke={5}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 12 }}>{cat.score == null ? "–" : `${Math.round(cat.score)}`}</Text>
                </Ring>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12 }} numberOfLines={1}>
                  {CAT[cat.category]?.[lang] ?? cat.category}
                </Text>
                <Text variant="faint">
                  {cat.done}/{cat.planned}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

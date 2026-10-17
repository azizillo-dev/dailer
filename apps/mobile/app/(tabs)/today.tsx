import { router, useFocusEffect } from "expo-router";
import { Check, CircleSlash, Clock3, Flame, Minus, Moon, ShieldCheck, Sun, Sunrise, Timer, type LucideIcon } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Image, Modal, Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bar, Button, Card, IconButton, MottoCard, Press, Ring, SectionTitle, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { itemIcon } from "@/lib/icons";
import { cancelFor } from "@/lib/notifications";
import { fonts, MAX_W, radius, usePalette, type Palette } from "@/lib/theme";

type Status = "done" | "partial" | "missed" | "excused";
type Entry = {
  item: { id: string; title: string; icon: string; category: string; duration_min: number | null; target_value: number | null; unit: string | null };
  time: string | null;
  checkin: { id: string; status: Status; value: number | null } | null;
};
type Day = {
  date: string;
  prayer_times: Record<string, string>;
  items: Entry[];
  summary: { planned: number; done: number; partial: number; excused: number; score: number | null };
};
type Weekly = { days: { date: string; score: number | null }[]; streak: { current: number } };

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_NAME: Record<string, Record<string, string>> = {
  fajr: { uz: "Bomdod", ru: "Фаджр", en: "Fajr" },
  dhuhr: { uz: "Peshin", ru: "Зухр", en: "Dhuhr" },
  asr: { uz: "Asr", ru: "Аср", en: "Asr" },
  maghrib: { uz: "Shom", ru: "Магриб", en: "Maghrib" },
  isha: { uz: "Xufton", ru: "Иша", en: "Isha" },
};
const GROUPS: { key: "morning" | "day" | "evening"; icon: LucideIcon }[] = [
  { key: "morning", icon: Sunrise },
  { key: "day", icon: Sun },
  { key: "evening", icon: Moon },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const groupOf = (time: string | null) => (time == null ? "day" : mins(time) < 12 * 60 ? "morning" : mins(time) < 18 * 60 ? "day" : "evening");

/** Hozirgi (vaqti kelgan) yoki keyingi bajarilmagan vazifa. */
function pickCurrent(items: Entry[], nowMin: number): { entry: Entry; now: boolean } | null {
  const pending = items.filter((e) => !e.checkin && e.time);
  const live = pending.filter((e) => mins(e.time!) <= nowMin && mins(e.time!) + Math.max(e.item.duration_min ?? 0, 20) >= nowMin);
  if (live.length) return { entry: live[live.length - 1], now: true };
  const upcoming = pending.find((e) => mins(e.time!) > nowMin);
  return upcoming ? { entry: upcoming, now: false } : null;
}

export default function Today() {
  const { t, lang } = useI18n();
  const c = usePalette();
  const { me } = useAuth();
  const today = useMemo(() => iso(new Date()), []);
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<Day | null>(null);
  const [week, setWeek] = useState<Weekly | null>(null);
  const [focusMin, setFocusMin] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<Entry | null>(null);
  const wide = useWindowDimensions().width >= 900;

  const load = useCallback(async (d: string) => {
    try {
      setDay(await api<Day>(`/api/v1/today?date=${d}`, { auth: true }));
    } catch {}
  }, []);
  const loadSide = useCallback(() => {
    api<Weekly>("/api/v1/stats/weekly", { auth: true }).then(setWeek).catch(() => {});
    api<{ days: { minutes: number }[] }>("/api/v1/pomodoro/stats", { auth: true })
      .then((r) => setFocusMin(r.days[r.days.length - 1]?.minutes ?? 0))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(date);
      loadSide();
    }, [date, load, loadSide]),
  );

  async function mark(e: Entry, status: Status | null) {
    if (!day) return;
    const prev = day;
    const items = day.items.map((x) =>
      x.item.id === e.item.id ? { ...x, checkin: status ? { id: x.checkin?.id ?? "p", status, value: x.checkin?.value ?? null } : null } : x,
    );
    setDay({ ...day, items });
    try {
      if (status) {
        await api("/api/v1/checkins?source=app", { method: "PUT", auth: true, body: { routine_item_id: e.item.id, date: day.date, status } });
        cancelFor(e.item.id, day.date).catch(() => {});
      } else if (e.checkin && e.checkin.id !== "p") {
        await api(`/api/v1/checkins/${e.checkin.id}`, { method: "DELETE", auth: true });
      }
      load(day.date);
      loadSide();
    } catch {
      setDay(prev);
    }
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = date === today;
  const s = day?.summary;
  const pct = s?.score != null ? Math.round(s.score) : null;
  const current = isToday && day ? pickCurrent(day.items, nowMin) : null;
  const nextPrayer = isToday ? PRAYERS.find((p) => day?.prayer_times[p] && mins(day.prayer_times[p]) > nowMin) : undefined;
  const firstName = me?.profile.full_name.split(" ")[0] ?? "";
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn-UZ" : lang, { weekday: "long", day: "numeric", month: "long" });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, gap: 10, paddingBottom: 28, width: "100%", maxWidth: wide ? 1100 : MAX_W, alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.highlight}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([load(date), loadSide()]);
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Sarlavha */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text variant="faint" style={{ textTransform: "capitalize" }}>
              {dateLabel}
            </Text>
            <Text variant="h2" numberOfLines={1}>
              {t("today.hello")}, {firstName}
            </Text>
          </View>
          <IconButton icon={Clock3} label={t("clock.title")} size={38} onPress={() => router.push("/clock")} />
          <Press onPress={() => router.push("/profile")} accessibilityLabel={t("tab.profile")} style={avatar(c)}>
            {me?.profile.avatar_url ? (
              <Image source={{ uri: me.profile.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
            ) : (
              <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: c.highlight }}>{firstName.slice(0, 1).toUpperCase()}</Text>
            )}
          </Press>
        </View>

        {/* Hafta lentasi */}
        {week && (
          <View style={{ flexDirection: "row", gap: 5 }}>
            {week.days.map((d) => {
              const on = d.date === date;
              const future = d.date > today;
              const wd = new Date(`${d.date}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn-UZ" : lang, { weekday: "short" }).slice(0, 2);
              return (
                <Press
                  key={d.date}
                  disabled={future}
                  onPress={() => setDate(d.date)}
                  accessibilityLabel={d.date}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 7,
                    gap: 3,
                    borderRadius: radius.md,
                    backgroundColor: on ? c.accent : c.surface,
                    borderWidth: 1,
                    borderColor: on ? c.accent : d.date === today ? c.caramel : c.line,
                    opacity: future ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, color: on ? c.accentInk : c.inkFaint, textTransform: "capitalize" }}>{wd}</Text>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: on ? c.accentInk : c.ink }}>{Number(d.date.slice(8))}</Text>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: scoreColor(c, d.score, on) }} />
                </Press>
              );
            })}
          </View>
        )}

        <View style={wide ? { flexDirection: "row", gap: 14, alignItems: "flex-start" } : { gap: 10 }}>
        <View style={wide ? { width: 380, gap: 10 } : { gap: 10 }}>
        {/* Kun bali */}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Ring value={(pct ?? 0) / 100} size={74} stroke={7}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: c.ink }}>
              {pct ?? "–"}
              {pct != null && <Text style={{ fontSize: 11, color: c.inkFaint }}>%</Text>}
            </Text>
          </Ring>
          <View style={{ flex: 1, gap: 6 }}>
            <View>
              <Text variant="eyebrow">{t("today.score")}</Text>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: c.ink, marginTop: 2 }}>{t("today.of", { done: s?.done ?? 0, total: s?.planned ?? 0 })}</Text>
            </View>
            <Bar value={s?.planned ? s.done / s.planned : 0} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Stat icon={Flame} value={week?.streak.current ?? 0} label={t("today.streak")} />
              <Stat icon={Timer} value={focusMin} label={t("today.focusMin")} />
            </View>
          </View>
        </Card>

        {/* Hozir / keyingi */}
        {isToday && current && (
          <View style={{ borderRadius: radius.lg, backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.caramel, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <IconBubble name={current.entry.item.icon} size={36} strong />
              <View style={{ flex: 1 }}>
                <Text variant="eyebrow">
                  {current.now ? t("today.now") : t("today.next")} · {current.entry.time?.slice(0, 5)}
                </Text>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 15, color: c.ink }} numberOfLines={1}>
                  {current.entry.item.title}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={t("status.done")} icon={Check} size="sm" onPress={() => mark(current.entry, "done")} style={{ flex: 1 }} />
              <Button title={t("tab.focus")} icon={Timer} size="sm" kind="ghost" onPress={() => router.push("/focus")} style={{ flex: 1 }} />
            </View>
          </View>
        )}
        {isToday && !current && s && s.planned > 0 && s.done + s.excused >= s.planned && (
          <View style={{ borderRadius: radius.lg, backgroundColor: c.accentSoft, padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ShieldCheck color={c.highlight} size={18} />
            <Text style={{ fontFamily: fonts.sansSemi, color: c.ink, flex: 1 }}>{t("today.allDone")}</Text>
          </View>
        )}

        <MottoCard goal={me?.profile.main_goal ?? null} />

        {/* Namoz vaqtlari */}
        {me?.profile.prays && day && PRAYERS.some((p) => day.prayer_times[p]) && (
          <Card padded={false} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 4 }}>
            {PRAYERS.map((p) => {
              const on = p === nextPrayer;
              return (
                <View key={p} style={{ flex: 1, alignItems: "center", paddingVertical: 5, marginHorizontal: 2, borderRadius: radius.sm, backgroundColor: on ? c.accentSoft : "transparent" }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, color: on ? c.highlight : c.inkFaint }}>{PRAYER_NAME[p][lang]}</Text>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: on ? c.highlight : c.ink }}>{day.prayer_times[p]?.slice(0, 5)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        </View>

        <View style={wide ? { flex: 1, gap: 10 } : { gap: 10 }}>
        {day && day.items.length === 0 && (
          <Card>
            <Text variant="soft">{t("today.empty")}</Text>
          </Card>
        )}

        {/* Vazifalar — kun qismlari bo'yicha */}
        {day &&
          GROUPS.map(({ key, icon: GIcon }) => {
            const list = day.items.filter((e) => groupOf(e.time) === key);
            if (!list.length) return null;
            const done = list.filter((e) => e.checkin?.status === "done").length;
            return (
              <View key={key} style={{ gap: 6 }}>
                <SectionTitle
                  title={t(`today.${key}` as MessageKey)}
                  right={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <GIcon color={c.inkFaint} size={13} />
                      <Text variant="faint" style={{ fontFamily: fonts.sansBold }}>
                        {done}/{list.length}
                      </Text>
                    </View>
                  }
                />
                <Card padded={false} style={{ overflow: "hidden" }}>
                  {list.map((e, i) => (
                    <Row key={e.item.id} e={e} first={i === 0} highlight={current?.entry.item.id === e.item.id} onPress={() => mark(e, e.checkin?.status === "done" ? null : "done")} onLong={() => setMenu(e)} />
                  ))}
                </Card>
              </View>
            );
          })}
        {day && day.items.length > 0 && (
          <Text variant="faint" style={{ textAlign: "center", marginTop: 2 }}>
            {t("today.hint")}
          </Text>
        )}
        </View>
        </View>
      </ScrollView>

      {/* Holat tanlash — ixcham pastki oyna */}
      <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={() => setMenu(null)} />
        <View style={{ backgroundColor: c.surface, padding: 16, paddingBottom: 28, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, gap: 12, width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: c.line }} />
          <Text variant="h3" numberOfLines={1}>
            {menu?.item.title}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(
              [
                ["done", Check],
                ["partial", Minus],
                ["missed", CircleSlash],
                ["excused", ShieldCheck],
              ] as [Status, LucideIcon][]
            ).map(([st, Icon]) => {
              const on = menu?.checkin?.status === st;
              return (
                <Press
                  key={st}
                  onPress={() => {
                    if (menu) mark(menu, st);
                    setMenu(null);
                  }}
                  style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : "transparent" }}
                >
                  <Icon color={st === "missed" ? c.danger : c.highlight} size={18} />
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11.5, color: c.ink }}>{t(`status.${st}` as MessageKey)}</Text>
                </Press>
              );
            })}
          </View>
          {menu?.checkin && (
            <Button
              title={t("status.clear")}
              kind="ghost"
              size="sm"
              onPress={() => {
                if (menu) mark(menu, null);
                setMenu(null);
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ e, first, highlight, onPress, onLong }: { e: Entry; first: boolean; highlight: boolean; onPress: () => void; onLong: () => void }) {
  const c = usePalette();
  const { t } = useI18n();
  const st = e.checkin?.status;
  const muted = st === "missed" || st === "excused";
  return (
    <Press
      onPress={onPress}
      onLongPress={onLong}
      delayLongPress={350}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
        backgroundColor: highlight ? c.accentSoft : "transparent",
        opacity: muted ? 0.6 : 1,
      }}
    >
      <Text style={{ width: 36, fontFamily: fonts.sansBold, fontSize: 11, color: c.inkFaint }}>{e.time?.slice(0, 5) ?? ""}</Text>
      <IconBubble name={e.item.icon} size={28} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.sansSemi, fontSize: 13.5, textDecorationLine: st === "done" ? "line-through" : "none", color: st === "done" ? c.inkFaint : c.ink }}
        >
          {e.item.title}
        </Text>
        {(e.item.duration_min || (st && st !== "done")) && (
          <Text variant="faint">
            {[e.item.duration_min ? `${e.item.duration_min} ${t("common.min")}` : null, st && st !== "done" ? t(`status.${st}` as MessageKey) : null].filter(Boolean).join(" · ")}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: st === "done" ? c.accent : "transparent",
          borderWidth: st === "done" ? 0 : 1.5,
          borderColor: st === "missed" ? c.danger : st ? c.highlight : c.line,
        }}
      >
        {st === "done" && <Check color={c.accentInk} size={14} strokeWidth={3} />}
        {st === "missed" && <Minus color={c.danger} size={14} strokeWidth={3} />}
        {st === "partial" && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.highlight }} />}
        {st === "excused" && <Text style={{ fontFamily: fonts.sansBold, fontSize: 9, color: c.inkFaint }}>U</Text>}
      </View>
    </Press>
  );
}

function IconBubble({ name, size, strong }: { name: string; size: number; strong?: boolean }) {
  const c = usePalette();
  const Icon = itemIcon(name);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: strong ? c.accent : c.accentSoft }}>
      <Icon color={strong ? c.accentInk : c.highlight} size={Math.round(size * 0.5)} />
    </View>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  const c = usePalette();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surface2, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Icon color={c.highlight} size={12} />
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 11.5, color: c.ink }}>{value}</Text>
      <Text style={{ fontFamily: fonts.sans, fontSize: 10.5, color: c.inkFaint }}>{label}</Text>
    </View>
  );
}

function scoreColor(c: Palette, score: number | null, on: boolean) {
  if (score == null) return on ? c.accentInk : "transparent";
  if (score >= 70) return on ? c.accentInk : c.success;
  if (score >= 40) return on ? c.accentInk : c.caramel;
  return on ? c.accentInk : c.danger;
}

function avatar(c: Palette) {
  return { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: "center" as const, justifyContent: "center" as const, overflow: "hidden" as const };
}

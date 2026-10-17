import { Check } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, KeyboardAvoidingView, Platform, ScrollView, Text as RNText, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Text } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { fonts, radius, usePalette } from "@/lib/theme";

/** Dailer belgisi: karamel yoy + "D". */
export function Logo({ size = 40 }: { size?: number }) {
  const c = usePalette();
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={3} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.caramel} strokeWidth={3} strokeLinecap="round" fill="none" strokeDasharray={circ} strokeDashoffset={circ * 0.28} />
      </Svg>
      <RNText style={{ fontFamily: fonts.serif, fontSize: size * 0.45, color: c.ink, marginTop: -1 }}>D</RNText>
    </View>
  );
}

/** Kun tartibidan kichik namuna — ilova nima qilishini bir qarashda ko'rsatadi. */
function DayPreview() {
  const c = usePalette();
  const { lang } = useI18n();
  const rows =
    lang === "ru"
      ? [["05:00", "Подъём", true], ["05:30", "Фаджр", true], ["06:00", "Чтение · 20 мин", false]]
      : lang === "en"
        ? [["05:00", "Wake up", true], ["05:30", "Fajr", true], ["06:00", "Reading · 20 min", false]]
        : [["05:00", "Uyg'onish", true], ["05:30", "Bomdod", true], ["06:00", "Kitob · 20 daq", false]];
  const fade = useRef(rows.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      140,
      fade.map((v) => Animated.timing(v, { toValue: 1, duration: 380, useNativeDriver: Platform.OS !== "web" })),
    ).start();
  }, [fade]);
  return (
    <View style={{ gap: 6 }}>
      {rows.map(([time, title, done], i) => (
        <Animated.View
          key={i}
          style={{
            opacity: fade[i],
            transform: [{ translateY: fade[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radius.md,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            marginLeft: i * 14,
          }}
        >
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: c.inkFaint, width: 34 }}>{time as string}</Text>
          <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 12.5, color: done ? c.inkFaint : c.ink, textDecorationLine: done ? "line-through" : "none" }}>
            {title as string}
          </Text>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: done ? c.accent : "transparent",
              borderWidth: done ? 0 : 1.5,
              borderColor: c.caramel,
            }}
          >
            {done && <Check color={c.accentInk} size={11} strokeWidth={3} />}
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function AuthLayout({ title, lead, preview, children, footer }: { title: string; lead?: string; preview?: boolean; children: React.ReactNode; footer?: React.ReactNode }) {
  const c = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 18, justifyContent: "center", width: "100%", maxWidth: 460, alignSelf: "center" }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Logo />
            <RNText style={{ fontFamily: fonts.serif, fontSize: 19, color: c.ink }}>Dailer</RNText>
          </View>

          <View style={{ gap: 6 }}>
            <Text variant="title" style={{ fontSize: 26, lineHeight: 32 }}>
              {title}
            </Text>
            {lead && <Text variant="soft">{lead}</Text>}
          </View>

          {preview && <DayPreview />}

          <View style={{ backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.line, padding: 16, gap: 12 }}>{children}</View>

          {footer}

          <RNText style={{ textAlign: "center", fontFamily: fonts.serifItalic, fontSize: 12.5, color: c.inkFaint }}>“Don't forget why you started!”</RNText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

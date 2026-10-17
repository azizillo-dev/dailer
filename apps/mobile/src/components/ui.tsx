import * as Haptics from "expo-haptics";
import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { center, fonts, radius, usePalette } from "@/lib/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Screen({ children, scroll = true, padded = true }: { children: React.ReactNode; scroll?: boolean; padded?: boolean }) {
  const c = usePalette();
  const content = <View style={[padded && { paddingHorizontal: 16, paddingBottom: 28 }, { gap: 10 }, center]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingTop: 10 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: 10 }}>{content}</View>
      )}
    </SafeAreaView>
  );
}

type Variant = "title" | "h2" | "h3" | "body" | "soft" | "faint" | "eyebrow" | "serif";

export function Text({ variant = "body", style, ...rest }: TextProps & { variant?: Variant }) {
  const c = usePalette();
  const map: Record<Variant, object> = {
    title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: c.ink, letterSpacing: -0.3 },
    h2: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 24, color: c.ink },
    h3: { fontFamily: fonts.sansBold, fontSize: 14, lineHeight: 19, color: c.ink },
    serif: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 22, color: c.ink },
    body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: c.ink },
    soft: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: c.inkSoft },
    faint: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 15, color: c.inkFaint },
    eyebrow: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: c.highlight },
  };
  return <RNText {...rest} style={[map[variant], style]} />;
}

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const c = usePalette();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, padding: padded ? 14 : 0 }, style]}>
      {children}
    </View>
  );
}

/** Bosilganda yengil "cho'kish" (faqat transform, native driver). */
export function Press({
  children,
  style,
  onPress,
  haptic = true,
  ...rest
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; haptic?: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== "web", speed: 40, bounciness: 6 }).start();
  // Joylashuv (flex, alignSelf, width) tashqi Pressable'ga ham kerak — aks holda qatorda cho'zilmaydi
  const flat: ViewStyle = StyleSheet.flatten(style) ?? {};
  const { flex, flexGrow, flexShrink, alignSelf, width, ...rest2 } = flat;
  const outer: ViewStyle = { flex, flexGrow, flexShrink, alignSelf, width };
  const inner: ViewStyle = width != null ? { ...rest2, width: "100%" } : rest2;
  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptic && Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
    >
      <Animated.View style={[inner, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  kind = "primary",
  size = "md",
  icon: Icon,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: "primary" | "soft" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const c = usePalette();
  const bg = kind === "primary" ? c.accent : kind === "soft" ? c.accentSoft : "transparent";
  const fg = kind === "primary" ? c.accentInk : kind === "danger" ? c.danger : kind === "soft" ? c.highlight : c.ink;
  const h = size === "sm" ? 34 : 44;
  return (
    <Press
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={{
        height: h,
        borderRadius: radius.full,
        backgroundColor: bg,
        borderWidth: kind === "ghost" || kind === "danger" ? 1 : 0,
        borderColor: c.line,
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: size === "sm" ? 14 : 20,
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {Icon && <Icon color={fg} size={size === "sm" ? 14 : 16} strokeWidth={2.4} />}
          <RNText style={{ color: fg, fontFamily: fonts.sansBold, fontSize: size === "sm" ? 12.5 : 14 }}>{title}</RNText>
        </>
      )}
    </Press>
  );
}

/** Kichik dumaloq ikonka tugmasi. */
export function IconButton({ icon: Icon, onPress, label, size = 34, disabled, tone = "line" }: { icon: LucideIcon; onPress?: () => void; label: string; size?: number; disabled?: boolean; tone?: "line" | "soft" }) {
  const c = usePalette();
  return (
    <Press
      onPress={disabled ? undefined : onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: tone === "line" ? 1 : 0,
        borderColor: c.line,
        backgroundColor: tone === "soft" ? c.accentSoft : "transparent",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <Icon color={tone === "soft" ? c.highlight : c.ink} size={Math.round(size * 0.45)} />
    </Press>
  );
}

export function Field({ label, icon: Icon, ...rest }: TextInputProps & { label?: string; icon?: LucideIcon }) {
  const c = usePalette();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!rest.secureTextEntry);
  const multi = !!rest.multiline;
  return (
    <View style={{ gap: 5 }}>
      {label && <Text variant="faint" style={{ fontFamily: fonts.sansSemi, color: c.inkSoft, fontSize: 12 }}>{label}</Text>}
      <View
        style={{
          flexDirection: "row",
          alignItems: multi ? "flex-start" : "center",
          minHeight: multi ? 84 : 44,
          borderRadius: radius.md,
          backgroundColor: c.bg,
          borderWidth: 1,
          borderColor: focused ? c.accent : c.line,
          paddingHorizontal: 12,
          gap: 8,
        }}
      >
        {Icon && <Icon color={focused ? c.highlight : c.inkFaint} size={16} style={multi ? { marginTop: 12 } : undefined} />}
        <TextInput
          placeholderTextColor={c.inkFaint}
          {...rest}
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minHeight: multi ? 84 : 42,
              paddingVertical: multi ? 10 : 0,
              color: c.ink,
              fontFamily: fonts.sans,
              fontSize: 14,
              textAlignVertical: multi ? "top" : "center",
            },
            Platform.OS === "web" && ({ outlineStyle: "none" } as object),
            rest.style,
          ]}
        />
        {rest.secureTextEntry && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? "show" : "hide"}>
            {hidden ? <Eye color={c.inkFaint} size={16} /> : <EyeOff color={c.inkFaint} size={16} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Message({ kind, children }: { kind: "error" | "success"; children?: React.ReactNode }) {
  const c = usePalette();
  if (!children) return null;
  return (
    <View style={{ borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: kind === "error" ? "rgba(227,135,107,0.13)" : "rgba(156,183,132,0.15)" }}>
      <Text style={{ color: kind === "error" ? c.danger : c.success, fontFamily: fonts.sansSemi, fontSize: 12.5 }}>{children}</Text>
    </View>
  );
}

export function Ring({ value, size = 64, stroke = 6, color, track, children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const c = usePalette();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(1, value)), duration: 700, useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.line} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.caramel}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] })}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Ingichka progress chizig'i. */
export function Bar({ value, height = 5, color }: { value: number; height?: number; color?: string }) {
  const c = usePalette();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.line, overflow: "hidden" }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height, backgroundColor: color ?? c.caramel }} />
    </View>
  );
}

/** Tanlov tugmalari (segment) — til, rejim va h.k. */
export function Segment<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const c = usePalette();
  return (
    <View style={{ flexDirection: "row", backgroundColor: c.surface2, borderRadius: radius.full, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Press
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, height: 30, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.accent : "transparent" }}
          >
            <RNText style={{ fontFamily: fonts.sansBold, fontSize: 12, color: on ? c.accentInk : c.inkSoft }}>{o.label}</RNText>
          </Press>
        );
      })}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
      <Text variant="h3">{title}</Text>
      {right}
    </View>
  );
}

export function MottoCard({ goal }: { goal: string | null }) {
  const c = usePalette();
  return (
    <View style={{ borderRadius: radius.lg, backgroundColor: c.deep, paddingHorizontal: 14, paddingVertical: 12, borderLeftWidth: 3, borderLeftColor: c.caramel, gap: 3 }}>
      <RNText style={{ color: c.caramel, fontFamily: fonts.serifItalic, fontSize: 13 }}>“Don't forget why you started!”</RNText>
      {goal ? (
        <RNText numberOfLines={2} style={{ color: c.cream, fontFamily: fonts.serif, fontSize: 14.5, lineHeight: 20 }}>
          {goal}
        </RNText>
      ) : null}
    </View>
  );
}

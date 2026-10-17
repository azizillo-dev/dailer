import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, usePalette } from "@/lib/theme";

const MOTTO = "Don't forget why you started!";

/**
 * Ilova ochilganda: "Don't forget why you started!" harfma-harf yoziladi, ostida — oliy maqsad.
 * Barcha animatsiyalar native driver'da (faqat opacity/transform).
 */
export function Splash({ goal, onDone }: { goal: string | null; onDone: () => void }) {
  const c = usePalette();
  const chars = useMemo(() => Array.from(MOTTO), []);
  const words = useMemo(() => {
    let start = 0;
    return MOTTO.split(" ").map((text) => {
      const w = { text, start };
      start += text.length + 1; // bo'shliq ham bitta qadam
      return w;
    });
  }, []);
  const charOpacity = useRef(chars.map(() => new Animated.Value(0))).current;
  const mark = useRef(new Animated.Value(0)).current;
  const goalIn = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.timing(mark, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.stagger(
        42,
        charOpacity.map((v) => Animated.timing(v, { toValue: 1, duration: 80, useNativeDriver: true })),
      ),
      Animated.timing(goalIn, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(out, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]);
    seq.start(({ finished: f }) => {
      if (f) {
        setFinished(true);
        onDone();
      }
    });
    return () => seq.stop();
  }, [charOpacity, goalIn, mark, out, onDone]);

  if (finished) return null;

  const skip = () =>
    Animated.timing(out, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setFinished(true);
      onDone();
    });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, opacity: out, zIndex: 100 }]}>
      <Pressable style={styles.center} onPress={skip} accessibilityLabel={MOTTO}>
        <Animated.View
          style={[
            styles.mark,
            { backgroundColor: c.caramel, opacity: mark, transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
          ]}
        />
        {/* So'zlar bo'yicha guruhlangan — qator so'z o'rtasidan uzilmaydi */}
        <View style={styles.line}>
          {words.map((w, wi) => (
            <View key={wi} style={{ flexDirection: "row", marginRight: wi < words.length - 1 ? 9 : 0 }}>
              {Array.from(w.text).map((ch, ci) => (
                <Animated.Text
                  key={ci}
                  style={{ opacity: charOpacity[w.start + ci], color: c.ink, fontFamily: fonts.serif, fontSize: 34, lineHeight: 42 }}
                >
                  {ch}
                </Animated.Text>
              ))}
            </View>
          ))}
        </View>
        <Animated.View style={{ opacity: goalIn, transform: [{ translateY: goalIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }], alignItems: "center" }}>
          <View style={[styles.rule, { backgroundColor: c.caramel }]} />
          {goal ? (
            <Text style={{ color: c.inkSoft, fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 300 }}>{goal}</Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  mark: { width: 44, height: 22, borderTopLeftRadius: 44, borderTopRightRadius: 44, marginBottom: 28 },
  line: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 320 },
  rule: { width: 72, height: 2, marginTop: 24, marginBottom: 18 },
});

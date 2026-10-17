import { Redirect, Tabs } from "expo-router";
import { BarChart3, CalendarCheck2, Sparkles, Timer, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fonts, usePalette } from "@/lib/theme";

export default function TabsLayout() {
  const { me, loading } = useAuth();
  const { t } = useI18n();
  const c = usePalette();
  const insets = useSafeAreaInsets();
  if (!loading && !me) return <Redirect href="/login" />;
  if (me && !me.profile.onboarding_completed_at) return <Redirect href="/onboarding" />;

  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.highlight,
        tabBarInactiveTintColor: c.inkFaint,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 54 + bottom, paddingTop: 6, paddingBottom: bottom },
        tabBarItemStyle: { paddingVertical: 0, justifyContent: "center", gap: 3 },
        tabBarLabelStyle: { fontFamily: fonts.sansBold, fontSize: 10, lineHeight: 13, flexShrink: 0, marginTop: 0 },
        tabBarIconStyle: { height: 24, flexShrink: 0 },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="today" options={{ title: t("tab.today"), tabBarIcon: ({ color }) => <CalendarCheck2 color={color} size={20} /> }} />
      <Tabs.Screen name="stats" options={{ title: t("tab.stats"), tabBarIcon: ({ color }) => <BarChart3 color={color} size={20} /> }} />
      <Tabs.Screen name="ai" options={{ title: t("tab.ai"), tabBarIcon: ({ color }) => <Sparkles color={color} size={20} /> }} />
      <Tabs.Screen name="focus" options={{ title: t("tab.focus"), tabBarIcon: ({ color }) => <Timer color={color} size={20} /> }} />
      <Tabs.Screen name="profile" options={{ title: t("tab.profile"), tabBarIcon: ({ color }) => <UserRound color={color} size={20} /> }} />
    </Tabs>
  );
}

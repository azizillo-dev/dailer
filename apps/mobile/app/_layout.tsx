import { Fraunces_400Regular_Italic, Fraunces_500Medium } from "@expo-google-fonts/fraunces";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { AppState, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Splash } from "@/components/Splash";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { listenForActions, registerPushToken, rescheduleWeek, setupCategories } from "@/lib/notifications";
import { syncScreenTime } from "@/lib/screenTime";
import { ThemeProvider, usePalette, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Ilova tik turadi; faqat soat ekrani yonboshlaydi (app/clock.tsx)
if (Platform.OS !== "web") ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

function Shell() {
  const c = usePalette();
  const { scheme } = useTheme();
  const { me, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  // Kirgan foydalanuvchi: eslatmalarni qayta rejalashtirish, push token, "Bajardim" tugmasi
  useEffect(() => {
    if (!me?.profile.onboarding_completed_at) return;
    setupCategories()
      .then(() => rescheduleWeek())
      .catch(() => {});
    registerPushToken();
    // Ekran vaqti (Android): ochilganda va ilovaga qaytilganda serverga yuboriladi
    syncScreenTime().catch(() => {});
    const sub = AppState.addEventListener("change", (s) => s === "active" && syncScreenTime().catch(() => {}));
    const off = listenForActions(() => rescheduleWeek().catch(() => {}));
    return () => {
      sub.remove();
      off();
    };
  }, [me?.id, me?.profile.onboarding_completed_at]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "fade" }} />
      {!loading && !splashDone && <Splash goal={me?.profile.main_goal ?? null} onDone={onSplashDone} />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_400Regular_Italic,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

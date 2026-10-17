import { useState } from "react";
import { ActivityIndicator, Text as RNText, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Press, Text } from "@/components/ui";
import { api, ApiError, errorText, type LoginResult } from "@/lib/api";
import { googleAvailable, googleIdToken } from "@/lib/google";
import { useI18n } from "@/lib/i18n";
import { fonts, radius, usePalette } from "@/lib/theme";

function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

/** Google native xatosi → foydalanuvchiga tushunarli xabar (kod bilan — muammoni topish oson bo'lsin). */
function googleMessage(e: unknown, t: ReturnType<typeof useI18n>["t"]): string {
  if (e instanceof ApiError) return errorText(e, t("common.error"), t("common.network"));
  const code = String((e as { code?: string | number } | null)?.code ?? "");
  // 10 — DEVELOPER_ERROR: Google Cloud'dagi Android client (package / SHA-1) shu APK'ga mos emas
  if (code === "10" || code === "DEVELOPER_ERROR") return t("auth.googleConfig");
  if (code === "PLAY_SERVICES_NOT_AVAILABLE") return t("auth.googlePlay");
  return t("auth.googleFail", { code: code || "?" });
}

/** "Google bilan davom etish" — kirish ham, ro'yxatdan o'tish ham (backend o'zi ajratadi). */
export function GoogleButton({ onResult, onError }: { onResult: (r: LoginResult) => void; onError: (message: string) => void }) {
  const { t, lang } = useI18n();
  const c = usePalette();
  const [busy, setBusy] = useState(false);
  if (!googleAvailable()) return null;

  async function go() {
    setBusy(true);
    try {
      const idToken = await googleIdToken();
      if (!idToken) return; // bekor qilindi
      onResult(await api<LoginResult>("/api/v1/auth/google", { method: "POST", body: { id_token: idToken, language: lang } }));
    } catch (e) {
      onError(googleMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
        <Text variant="faint">{t("auth.or")}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
      </View>
      <Press
        onPress={busy ? undefined : go}
        accessibilityRole="button"
        style={{ height: 44, borderRadius: radius.full, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}
      >
        {busy ? <ActivityIndicator color={c.ink} size="small" /> : <GoogleLogo />}
        <RNText style={{ color: c.ink, fontFamily: fonts.sansBold, fontSize: 14 }}>{t("auth.google")}</RNText>
      </Press>
    </>
  );
}

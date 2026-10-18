import { Link, router } from "expo-router";
import { Lock, Mail, UserRound } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleButton } from "@/components/GoogleButton";
import { Button, Field, Message, Text } from "@/components/ui";
import { api, errorText, type LoginResult } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fonts, usePalette } from "@/lib/theme";

export default function Register() {
  const { t, lang } = useI18n();
  const c = usePalette();
  const { acceptLogin } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const r = await api<LoginResult>("/api/v1/auth/register", {
        method: "POST",
        body: { full_name: name.trim(), email: email.trim(), password, language: lang },
      });
      if (await acceptLogin(r)) router.replace("/onboarding");
    } catch (e) {
      setError(errorText(e, t("common.error"), t("common.network")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.registerTitle")}
      lead={t("hero.lead")}
      footer={
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Text variant="soft">{t("auth.haveAccount")}</Text>
          <Link href="/login">
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: c.highlight }}>{t("auth.login")}</Text>
          </Link>
        </View>
      }
    >
      <Field label={t("auth.name")} icon={UserRound} value={name} onChangeText={setName} autoComplete="name" />
      <Field label={t("auth.email")} icon={Mail} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@mail.com" />
      <Field label={t("auth.password")} icon={Lock} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="8+" />
      <Message kind="error">{error}</Message>
      <Button title={t("auth.register")} onPress={submit} loading={busy} disabled={!name || !email || password.length < 8} />
      <GoogleButton
        onResult={async (r) => {
          // Yangi foydalanuvchi — index o'zi onboarding'ga yo'naltiradi
          if (await acceptLogin(r)) router.replace("/");
          // 2FA yoqilgan admin — kod kirish sahifasida so'raladi
          else if (r.requires_2fa) router.replace("/login");
        }}
        onError={setError}
      />
    </AuthLayout>
  );
}

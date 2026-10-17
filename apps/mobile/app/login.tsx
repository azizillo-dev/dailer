import { Link, router } from "expo-router";
import { KeyRound, Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { AuthLayout } from "@/components/AuthLayout";
import { GoogleButton } from "@/components/GoogleButton";
import { Button, Field, Message, Text } from "@/components/ui";
import { api, errorText, type LoginResult, type TokenPair } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fonts, usePalette } from "@/lib/theme";

export default function Login() {
  const { t } = useI18n();
  const c = usePalette();
  const { acceptLogin, acceptTokens } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e, t("common.error"), t("common.network")));
    } finally {
      setBusy(false);
    }
  }

  async function handle(r: LoginResult) {
    if (await acceptLogin(r)) router.replace("/");
    else if (r.requires_2fa && r.mfa_token) setMfa(r.mfa_token);
  }

  const submit = () =>
    run(async () => {
      await handle(await api<LoginResult>("/api/v1/auth/login", { method: "POST", body: { email: email.trim(), password } }));
    });

  const verify = () =>
    run(async () => {
      const tokens = await api<TokenPair>("/api/v1/auth/2fa/verify", { method: "POST", body: { mfa_token: mfa, code } });
      await acceptTokens(tokens);
      router.replace("/");
    });

  return (
    <AuthLayout
      title={t("auth.loginTitle")}
      lead={t("hero.lead")}
      preview={!mfa}
      footer={
        !mfa && (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <Text variant="soft">{t("auth.noAccount")}</Text>
            <Link href="/register">
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 13, color: c.highlight }}>{t("auth.register")}</Text>
            </Link>
          </View>
        )
      }
    >
      {mfa ? (
        <>
          <Field label={t("auth.code")} icon={KeyRound} value={code} onChangeText={setCode} keyboardType="number-pad" autoFocus maxLength={16} />
          <Message kind="error">{error}</Message>
          <Button title={t("auth.verify")} onPress={verify} loading={busy} disabled={code.length < 6} />
        </>
      ) : (
        <>
          <Field label={t("auth.email")} icon={Mail} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@mail.com" />
          <Field label={t("auth.password")} icon={Lock} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="••••••••" onSubmitEditing={submit} />
          <Link href="/forgot" style={{ alignSelf: "flex-end" }}>
            <Text style={{ color: c.highlight, fontFamily: fonts.sansSemi, fontSize: 12 }}>{t("auth.forgot")}</Text>
          </Link>
          <Message kind="error">{error}</Message>
          <Button title={t("auth.login")} onPress={submit} loading={busy} disabled={!email || !password} />
          <GoogleButton onResult={(r) => run(() => handle(r))} onError={setError} />
        </>
      )}
    </AuthLayout>
  );
}

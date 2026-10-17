import { router } from "expo-router";
import { ArrowLeft, Mail } from "lucide-react-native";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Field, Message } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function Forgot() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      await api("/api/v1/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setSent(true);
    } catch (e) {
      setError(errorText(e, t("common.error"), t("common.network")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t("auth.forgotTitle")} footer={<Button title={t("auth.login")} icon={ArrowLeft} kind="ghost" size="sm" onPress={() => router.replace("/login")} style={{ alignSelf: "center" }} />}>
      {sent ? (
        <Message kind="success">{t("auth.forgotSent")}</Message>
      ) : (
        <>
          <Field label={t("auth.email")} icon={Mail} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@mail.com" />
          <Message kind="error">{error}</Message>
          <Button title={t("auth.send")} onPress={submit} loading={busy} disabled={!email} />
        </>
      )}
    </AuthLayout>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, Field, FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

function ResetForm() {
  const { t } = useI18n();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repeat) {
      setError(t("reset.mismatch"));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/api/v1/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (!token) return <FormMessage kind="error">{t("reset.noToken")}</FormMessage>;

  if (done) {
    return (
      <div className="space-y-6">
        <FormMessage kind="success">{t("reset.done")}</FormMessage>
        <Link href="/login" className="btn-primary w-full">
          {t("nav.login")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        label={t("auth.newPassword")}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        hint={t("auth.passwordHint")}
        required
        minLength={8}
        autoFocus
      />
      <Field
        label={t("auth.repeatPassword")}
        type="password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        autoComplete="new-password"
        required
        minLength={8}
      />
      <FormMessage kind="error">{error}</FormMessage>
      <button className="btn-primary w-full" disabled={busy}>
        {t("reset.submit")}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  return (
    <AuthShell title={t("reset.title")} subtitle={t("reset.subtitle")}>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, Field, FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/v1/auth/forgot-password", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t("forgot.title")} subtitle={t("forgot.subtitle")}>
      {sent ? (
        <FormMessage kind="success">{t("forgot.sent")}</FormMessage>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Field
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
          <FormMessage kind="error">{error}</FormMessage>
          <button className="btn-primary w-full" disabled={busy}>
            {t("forgot.submit")}
          </button>
        </form>
      )}
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-semibold text-ink-soft hover:text-ink">
          ← {t("forgot.back")}
        </Link>
      </p>
    </AuthShell>
  );
}

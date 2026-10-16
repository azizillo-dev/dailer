"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, FormMessage } from "@/components/AuthShell";
import { GoogleButton } from "@/components/GoogleButton";
import { api, type LoginResult } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export default function RegisterPage() {
  const { t, lang } = useI18n();
  const { acceptLogin } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<LoginResult>) {
    setError("");
    setBusy(true);
    try {
      const result = await fn();
      if (await acceptLogin(result)) router.replace("/today");
      else router.replace("/login");
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      api<LoginResult>("/api/v1/auth/register", {
        method: "POST",
        body: { full_name: name, email, password, language: lang },
      }),
    );
  };

  const google = (idToken: string) =>
    run(() =>
      api<LoginResult>("/api/v1/auth/google", {
        method: "POST",
        body: { id_token: idToken, language: lang },
      }),
    );

  return (
    <AuthShell title={t("register.title")} subtitle={t("register.subtitle")}>
      <form onSubmit={submit} className="space-y-5">
        <Field
          label={t("auth.name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          maxLength={120}
        />
        <Field
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Field
          label={t("auth.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          hint={t("auth.passwordHint")}
          required
          minLength={8}
        />
        <FormMessage kind="error">{error}</FormMessage>
        <button className="btn-primary w-full" disabled={busy}>
          {t("register.submit")}
        </button>
        <p className="text-center text-xs leading-relaxed text-ink-faint">{t("register.terms")}</p>
      </form>

      <GoogleButton onCredential={google} />

      <p className="mt-8 text-center text-sm text-ink-soft">
        {t("register.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t("nav.login")}
        </Link>
      </p>
    </AuthShell>
  );
}

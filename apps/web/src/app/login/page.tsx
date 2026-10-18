"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, FormMessage } from "@/components/AuthShell";
import { GoogleButton } from "@/components/GoogleButton";
import { api, type LoginResult, type TokenPair } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t, lang } = useI18n();
  const { acceptLogin, acceptTokens } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleResult(result: LoginResult) {
    if (await acceptLogin(result)) {
      // Admin, 2FA hali sozlanmagan — to'g'ri admin panelga (u yerda 2FA sozlash ekrani)
      router.replace(result.requires_2fa_setup ? "/admin" : "/today");
    } else if (result.requires_2fa && result.mfa_token) {
      setMfaToken(result.mfa_token);
    }
  }

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const result = await api<LoginResult>("/api/v1/auth/login", {
        method: "POST",
        body: { email, password },
      });
      await handleResult(result);
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const tokens = await api<TokenPair>("/api/v1/auth/2fa/verify", {
        method: "POST",
        body: { mfa_token: mfaToken, code },
      });
      await acceptTokens(tokens);
      // 2FA faqat adminlarda bor — kirgach admin panelga
      router.replace("/admin");
    });
  };

  const google = (idToken: string) =>
    run(async () => {
      const result = await api<LoginResult>("/api/v1/auth/google", {
        method: "POST",
        body: { id_token: idToken, language: lang },
      });
      await handleResult(result);
    });

  if (mfaToken) {
    return (
      <AuthShell title={t("twofa.title")} subtitle={t("twofa.subtitle")}>
        <form onSubmit={submitCode} className="space-y-5">
          <Field
            label={t("twofa.code")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            minLength={6}
            maxLength={16}
          />
          <FormMessage kind="error">{error}</FormMessage>
          <button className="btn-primary w-full" disabled={busy}>
            {t("twofa.submit")}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t("login.title")} subtitle={t("login.subtitle")}>
      <form onSubmit={submitPassword} className="space-y-5">
        <Field
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <div>
          <Field
            label={t("auth.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-highlight hover:underline">
              {t("login.forgot")}
            </Link>
          </div>
        </div>
        <FormMessage kind="error">{error}</FormMessage>
        <button className="btn-primary w-full" disabled={busy}>
          {t("login.submit")}
        </button>
      </form>

      <GoogleButton onCredential={google} />

      <p className="mt-8 text-center text-sm text-ink-soft">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="font-semibold text-ink underline-offset-4 hover:underline">
          {t("login.register")}
        </Link>
      </p>
    </AuthShell>
  );
}

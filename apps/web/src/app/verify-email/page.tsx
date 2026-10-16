"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell, FormMessage } from "@/components/AuthShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

function Verify() {
  const { t } = useI18n();
  const { refreshMe, me } = useAuth();
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    // React StrictMode'da effekt ikki marta ishlaydi — token bir martalik
    if (started.current) return;
    started.current = true;
    if (!token) {
      setError(t("reset.noToken"));
      setState("error");
      return;
    }
    api("/api/v1/auth/verify-email", { method: "POST", body: { token } })
      .then(async () => {
        setState("done");
        await refreshMe();
      })
      .catch((err) => {
        setError(errorText(err, t));
        setState("error");
      });
  }, [token, t, refreshMe]);

  if (state === "loading") return <p className="text-ink-soft">{t("verify.loading")}</p>;
  if (state === "error") return <FormMessage kind="error">{error}</FormMessage>;
  return (
    <div className="space-y-6">
      <FormMessage kind="success">{t("verify.done")}</FormMessage>
      <Link href={me ? "/today" : "/login"} className="btn-primary w-full">
        {t("verify.continue")}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email">
      <Suspense>
        <Verify />
      </Suspense>
    </AuthShell>
  );
}

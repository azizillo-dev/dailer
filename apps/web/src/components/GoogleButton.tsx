"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleId = {
  accounts: {
    id: {
      initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleId;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Google Identity Services tugmasi. Client ID sozlanmagan bo'lsa — ko'rinmaydi. */
export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { lang, t } = useI18n();
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (r) => callback.current(r.credential),
        });
        ref.current.innerHTML = "";
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          width: ref.current.offsetWidth,
          text: "continue_with",
          locale: lang,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={ref} className="flex h-11 w-full justify-center" aria-label={t("auth.google")} />
    </>
  );
}

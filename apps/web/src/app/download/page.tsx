"use client";

import { Download, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { APK_SIZE, APK_URL, APK_VERSION, AndroidIcon } from "@/components/AppDownload";
import { SiteHeader } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";

export default function DownloadPage() {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(APK_URL, { margin: 1, width: 220, color: { dark: "#2b1d14", light: "#fffdf9" } })
      .then(setQr)
      .catch(() => {});
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <section className="grid items-center gap-10 pt-6 sm:pt-12 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-espresso text-caramel">
              <AndroidIcon className="h-7 w-7" />
            </span>
            <h1 className="mt-6 font-serif text-[clamp(2.2rem,6vw,3.6rem)] leading-[1.05] tracking-tight">{t("dl.pageTitle")}</h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-soft">{t("dl.pageLead")}</p>
            <a href={APK_URL} className="btn-primary mt-8 inline-flex h-14 items-center gap-2 px-8 text-base">
              <Download className="h-5 w-5" /> {t("dl.button")}
            </a>
            <p className="mt-3 text-xs text-ink-faint">
              {t("dl.meta", { size: APK_SIZE || "APK", version: APK_VERSION })}
            </p>
          </div>

          {/* Kompyuterdan kirganlar uchun — telefonda skanerlash */}
          <div className="card hidden flex-col items-center p-6 text-center md:flex">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR" width={220} height={220} className="rounded-xl" />
            ) : (
              <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-surface-2" />
            )}
            <p className="mt-4 text-sm font-semibold text-ink-soft">{t("dl.scan")}</p>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div className="card p-6 sm:p-8">
            <h2 className="font-serif text-2xl">{t("dl.stepsTitle")}</h2>
            <ol className="mt-5 space-y-4">
              {(["dl.step1", "dl.step2", "dl.step3"] as const).map((k, i) => (
                <li key={k} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 font-serif text-highlight">{i + 1}</span>
                  <span className="pt-1 text-[15px] leading-relaxed">{t(k)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-4">
            <p className="flex gap-3 rounded-2xl bg-surface-2 p-5 text-sm leading-relaxed text-ink-soft">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-highlight" />
              {t("dl.note")}
            </p>
            <p className="rounded-2xl p-5 text-sm leading-relaxed text-ink-faint ring-1 ring-line">{t("dl.iphone")}</p>
          </div>
        </section>
      </main>
    </>
  );
}

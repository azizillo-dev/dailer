"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";

export type Motivation = {
  id: string;
  text: Record<string, string>;
  author: string | null;
  category: string;
  image_url: string | null;
};

export function MotivationCard({ m, large = false }: { m: Motivation; large?: boolean }) {
  const { lang, t } = useI18n();
  const [copied, setCopied] = useState(false);
  const text = m.text[lang] || m.text.uz;

  async function share() {
    const body = `“${text}”${m.author ? ` — ${m.author}` : ""}\n\nDailer · Don't forget why you started!`;
    try {
      if (navigator.share) await navigator.share({ text: body });
      else {
        await navigator.clipboard.writeText(body);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }

  return (
    <figure className={`card relative overflow-hidden ${large ? "p-7 sm:p-9" : "p-6"}`}>
      <span className="pointer-events-none absolute -left-2 -top-6 font-serif text-[120px] leading-none text-caramel/15" aria-hidden>
        “
      </span>
      <blockquote className={`relative font-serif leading-snug ${large ? "text-2xl sm:text-3xl" : "text-xl"}`}>{text}</blockquote>
      <figcaption className="relative mt-5 flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-highlight">
          {m.author ?? t(`mot.cat.${m.category}` as MessageKey)}
        </span>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-line hover:text-ink"
        >
          <Share2 className="h-3.5 w-3.5" /> {copied ? t("mot.copied") : t("mot.share")}
        </button>
      </figcaption>
    </figure>
  );
}

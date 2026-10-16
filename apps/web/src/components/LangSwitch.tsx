"use client";

import { LANGS, useI18n } from "@/lib/i18n";

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex rounded-full bg-surface-2 p-1 ring-1 ring-line" role="group">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.label}
          className={`h-8 rounded-full px-3 text-xs font-bold uppercase transition-colors duration-200 ${
            lang === l.code ? "bg-accent text-accent-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}

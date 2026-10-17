"use client";

import { useEffect, useState } from "react";
import { ItemIcon } from "./ItemIcon";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Badge = { code: string; icon: string; xp: number; title: string; text: string; earned_at: string | null };
type Data = { xp: number; level: number; level_xp: number; xp_in_level: number; new: string[]; badges: Badge[] };

export function Badges() {
  const { t, lang } = useI18n();
  const [d, setD] = useState<Data | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api<Data>("/api/v1/badges", { auth: true })
      .then((r) => {
        setD(r);
        const fresh = r.badges.find((b) => r.new.includes(b.code));
        if (fresh) setToast(t("bd.new", { name: fresh.title }));
      })
      .catch(() => {});
    // Til o'zgarsa nomlar ham yangilansin
  }, [lang, t]);

  if (!d) return null;
  const earned = d.badges.filter((b) => b.earned_at);
  return (
    <section className="card animate-rise p-5 sm:p-6">
      {toast && (
        <p role="status" className="animate-rise mb-4 rounded-2xl bg-highlight/15 px-4 py-3 text-center text-sm font-bold text-highlight">
          🎉 {toast}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl">{t("bd.title")}</h2>
          <p className="text-xs text-ink-faint">
            {earned.length}/{d.badges.length}
          </p>
        </div>
        <div className="text-right">
          <p className="font-serif text-2xl">{t("bd.level", { n: d.level })}</p>
          <p className="text-xs text-ink-faint">{t("bd.xp", { x: d.xp_in_level, t: d.level_xp })}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full origin-left rounded-full bg-caramel transition-transform duration-700" style={{ transform: `scaleX(${d.xp_in_level / d.level_xp})` }} />
      </div>
      <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {d.badges.map((b) => (
          <li
            key={b.code}
            className={`flex flex-col items-center rounded-2xl p-3 text-center ring-1 ${b.earned_at ? "bg-surface-2 ring-highlight/40" : "ring-line opacity-45"}`}
            title={`${b.title} — ${b.earned_at ? b.text : t("bd.locked")}`}
          >
            <span className={`grid h-12 w-12 place-items-center rounded-full ${b.earned_at ? "bg-caramel text-espresso" : "bg-surface-2 text-ink-faint"}`}>
              <ItemIcon name={b.icon} className="h-5 w-5" />
            </span>
            <span className="mt-2 text-xs font-bold leading-tight">{b.title}</span>
            <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink-faint">{b.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

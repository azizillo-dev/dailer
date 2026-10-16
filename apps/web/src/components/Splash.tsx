"use client";

import { useEffect, useState } from "react";

const MOTTO = "Don't forget why you started!";

/**
 * Ilova ochilganda bir marta ko'rinadi (sessiyada bir marta).
 * Animatsiya to'liq CSS'da — JavaScript yuklanmasdan oldin ham silliq boshlanadi.
 * Ko'rsatish/ko'rsatmaslik qarori layout'dagi kichik skriptda (birinchi chizishdan oldin).
 */
export function Splash() {
  const [goal, setGoal] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (document.documentElement.dataset.splash === "seen") {
      setGone(true);
      return;
    }
    try {
      setGoal(localStorage.getItem("dailer.goal"));
    } catch {}
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") setSkipped(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (gone) return null;

  return (
    <div
      className={`splash${skipped ? " is-skipped" : ""}`}
      onClick={() => setSkipped(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setGone(true);
      }}
      role="presentation"
    >
      <div className="splash-inner">
        <span className="splash-mark" aria-hidden />
        <p className="splash-text" aria-label={MOTTO}>
          {Array.from(MOTTO).map((ch, i) => (
            <span key={i} className="splash-char" style={{ "--i": i } as React.CSSProperties} aria-hidden>
              {ch}
            </span>
          ))}
          <span className="splash-caret caret" aria-hidden />
        </p>
        <span className="splash-rule" aria-hidden />
        {goal && <p className="splash-goal">{goal}</p>}
      </div>
    </div>
  );
}

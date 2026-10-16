"use client";

import { Check, LocateFixed, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormMessage } from "@/components/AuthShell";
import { ItemIcon } from "@/components/ItemIcon";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { api, type Me } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { hm, type PlanItem } from "@/lib/types";

const USER_TYPES = ["university_student", "school_pupil", "worker", "freelancer", "entrepreneur", "other"] as const;
type UserType = (typeof USER_TYPES)[number];
type Pray = "yes" | "sometimes" | "start" | "no";
const INTERESTS = ["reading", "sport", "language", "quran", "programming", "math", "study", "health", "sleep"] as const;

const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Toshkent", lat: 41.2995, lng: 69.2401 },
  { name: "Samarqand", lat: 39.6542, lng: 66.9597 },
  { name: "Buxoro", lat: 39.7747, lng: 64.4286 },
  { name: "Andijon", lat: 40.7821, lng: 72.3442 },
  { name: "Namangan", lat: 40.9983, lng: 71.6726 },
  { name: "Farg'ona", lat: 40.3864, lng: 71.7843 },
  { name: "Qarshi", lat: 38.86, lng: 65.79 },
  { name: "Termiz", lat: 37.2242, lng: 67.2783 },
  { name: "Navoiy", lat: 40.0844, lng: 65.3792 },
  { name: "Jizzax", lat: 40.1158, lng: 67.8422 },
  { name: "Guliston", lat: 40.4897, lng: 68.7842 },
  { name: "Urganch", lat: 41.55, lng: 60.6333 },
  { name: "Nukus", lat: 42.46, lng: 59.6 },
];

const STEPS = ["who", "age", "sleep", "pray", "place", "busy", "interests", "goal", "plan", "notify"] as const;
type Step = (typeof STEPS)[number];

type State = {
  userType: UserType | null;
  userTypeOther: string;
  birthYear: string;
  wake: string;
  sleep: string;
  pray: Pray | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  hasBusy: boolean | null;
  busyLabel: string;
  busyFrom: string;
  busyTo: string;
  busyDays: 31 | 63;
  interests: string[];
  goal: string;
};

const INITIAL: State = {
  userType: null,
  userTypeOther: "",
  birthYear: "",
  wake: "05:00",
  sleep: "23:00",
  pray: null,
  city: null,
  lat: null,
  lng: null,
  hasBusy: null,
  busyLabel: "",
  busyFrom: "08:00",
  busyTo: "12:20",
  busyDays: 31,
  interests: [],
  goal: "",
};

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left text-[15px] font-semibold ring-1 transition-[background-color,transform] duration-200 active:scale-[0.98] ${
        selected ? "bg-accent text-accent-ink ring-accent" : "bg-surface text-ink ring-line hover:bg-surface-2"
      }`}
    >
      {children}
      {selected && <Check className="h-5 w-5 shrink-0" />}
    </button>
  );
}

export default function OnboardingPage() {
  const { t, lang } = useI18n();
  const { me, loading, refreshMe } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("who");
  const [s, setS] = useState<State>(INITIAL);
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  const index = STEPS.indexOf(step);
  const currentYear = new Date().getFullYear();

  const canNext = useMemo(() => {
    switch (step) {
      case "who":
        return s.userType !== null && (s.userType !== "other" || s.userTypeOther.trim().length > 0);
      case "age": {
        const y = Number(s.birthYear);
        return y >= 1930 && y <= currentYear - 6;
      }
      case "sleep":
        return Boolean(s.wake && s.sleep);
      case "pray":
        return s.pray !== null;
      case "place":
        return s.lat !== null;
      case "busy":
        return s.hasBusy === false || (s.hasBusy === true && s.busyFrom < s.busyTo);
      case "interests":
        return s.interests.length > 0;
      case "goal":
        return s.goal.trim().length >= 3;
      default:
        return true;
    }
  }, [step, s, currentYear]);

  async function submitAnswers() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tashkent";
    const body = {
      user_type: s.userType,
      user_type_other: s.userType === "other" ? s.userTypeOther.trim() : null,
      birth_year: Number(s.birthYear),
      wake_time: s.wake,
      sleep_time: s.sleep,
      evening_summary_time: "21:30",
      prays: s.pray !== "no",
      city: s.city,
      latitude: s.lat,
      longitude: s.lng,
      timezone: tz,
      language: lang,
      interests: s.interests,
      busy_blocks: s.hasBusy
        ? [{ label: s.busyLabel.trim() || t("ob.busy.labelPlaceholder"), start: s.busyFrom, end: s.busyTo, days: s.busyDays }]
        : [],
      main_goal: s.goal.trim(),
    };
    await api<Me>("/api/v1/me/onboarding", { method: "POST", body, auth: true });
    setPlan(await api<PlanItem[]>("/api/v1/routine/starter-plan", { auth: true }));
  }

  async function acceptPlan() {
    const items = (plan ?? []).filter((_, i) => !removed.has(i));
    if (items.length) {
      await api("/api/v1/routine-items/bulk", { method: "POST", body: { items, replace: true }, auth: true });
    }
  }

  async function next() {
    setError("");
    setBusy(true);
    try {
      if (step === "goal") await submitAnswers();
      if (step === "plan") await acceptPlan();
      if (step === "notify") {
        await refreshMe();
        router.replace("/today");
        return;
      }
      setStep(STEPS[index + 1]);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  function detectLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setS((prev) => ({
          ...prev,
          lat: Math.round(pos.coords.latitude * 1e4) / 1e4,
          lng: Math.round(pos.coords.longitude * 1e4) / 1e4,
          city: null,
        }));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  }

  async function allowNotifications() {
    try {
      if ("Notification" in window) await Notification.requestPermission();
    } catch {}
    await next();
  }

  if (!me) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <header className="flex h-20 items-center justify-between">
        <Logo href="/" />
        <LangSwitch />
      </header>

      {/* Progress */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full origin-left rounded-full bg-highlight transition-transform duration-500 ease-out-soft"
          style={{ transform: `scaleX(${(index + 1) / STEPS.length})` }}
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-ink-faint">{t("ob.step", { n: index + 1, total: STEPS.length })}</p>

      <section key={step} className="animate-rise flex-1 py-8">
        {step === "who" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.who.title")}</h1>
            <div className="mt-7 grid gap-3">
              {USER_TYPES.map((u) => (
                <Choice key={u} selected={s.userType === u} onClick={() => set("userType", u)}>
                  {t(`ob.who.${u}` as MessageKey)}
                </Choice>
              ))}
              {s.userType === "other" && (
                <input
                  className="field"
                  autoFocus
                  maxLength={80}
                  placeholder={t("ob.who.otherPlaceholder")}
                  value={s.userTypeOther}
                  onChange={(e) => set("userTypeOther", e.target.value)}
                />
              )}
            </div>
          </>
        )}

        {step === "age" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.age.title")}</h1>
            <label className="mt-7 block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("ob.age.hint")}</span>
              <input
                className="field h-16 text-center font-serif text-3xl"
                inputMode="numeric"
                placeholder="2005"
                maxLength={4}
                autoFocus
                value={s.birthYear}
                onChange={(e) => set("birthYear", e.target.value.replace(/\D/g, ""))}
              />
            </label>
            {Number(s.birthYear) >= 1930 && Number(s.birthYear) <= currentYear && (
              <p className="mt-4 text-center text-ink-soft">{currentYear - Number(s.birthYear)}</p>
            )}
          </>
        )}

        {step === "sleep" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.sleep.title")}</h1>
            <p className="mt-3 text-ink-soft">{t("ob.sleep.hint")}</p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {(["wake", "sleep"] as const).map((k) => (
                <label key={k} className="card block p-5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                    <ItemIcon name={k === "wake" ? "sunrise" : "moon"} className="h-4 w-4" />
                    {t(k === "wake" ? "ob.sleep.wake" : "ob.sleep.sleep")}
                  </span>
                  <input
                    type="time"
                    className="mt-3 w-full bg-transparent font-serif text-3xl text-ink outline-none"
                    value={s[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </>
        )}

        {step === "pray" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.pray.title")}</h1>
            <div className="mt-7 grid gap-3">
              {(["yes", "sometimes", "start", "no"] as const).map((p) => (
                <Choice key={p} selected={s.pray === p} onClick={() => set("pray", p)}>
                  {t(`ob.pray.${p}` as MessageKey)}
                </Choice>
              ))}
            </div>
          </>
        )}

        {step === "place" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.place.title")}</h1>
            <p className="mt-3 text-ink-soft">{t("ob.place.hint")}</p>
            <button type="button" onClick={detectLocation} className="btn-ghost mt-7 w-full" disabled={locating}>
              <LocateFixed className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`} />
              {s.lat !== null && s.city === null ? `✓ ${t("ob.place.detected")}` : t("ob.place.detect")}
            </button>
            <p className="my-5 text-center text-xs font-semibold uppercase tracking-widest text-ink-faint">{t("ob.place.or")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CITIES.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setS((prev) => ({ ...prev, city: c.name, lat: c.lat, lng: c.lng }))}
                  className={`rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition-colors ${
                    s.city === c.name ? "bg-accent text-accent-ink ring-accent" : "bg-surface ring-line hover:bg-surface-2"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "busy" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.busy.title")}</h1>
            <p className="mt-3 text-ink-soft">{t("ob.busy.hint")}</p>
            <div className="mt-7 grid gap-3">
              <Choice selected={s.hasBusy === true} onClick={() => set("hasBusy", true)}>
                {t("ob.busy.has")}
              </Choice>
              {s.hasBusy && (
                <div className="card animate-rise space-y-4 p-5">
                  <input
                    className="field"
                    maxLength={60}
                    placeholder={t("ob.busy.labelPlaceholder")}
                    aria-label={t("ob.busy.label")}
                    value={s.busyLabel}
                    onChange={(e) => set("busyLabel", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {(["busyFrom", "busyTo"] as const).map((k) => (
                      <label key={k} className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                          {t(k === "busyFrom" ? "ob.busy.from" : "ob.busy.to")}
                        </span>
                        <input type="time" className="field" value={s[k]} onChange={(e) => set(k, e.target.value)} />
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {([31, 63] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => set("busyDays", d)}
                        className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ring-1 ${
                          s.busyDays === d ? "bg-accent text-accent-ink ring-accent" : "ring-line"
                        }`}
                      >
                        {t(d === 31 ? "ob.busy.mon_fri" : "ob.busy.mon_sat")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Choice selected={s.hasBusy === false} onClick={() => set("hasBusy", false)}>
                {t("ob.busy.none")}
              </Choice>
            </div>
          </>
        )}

        {step === "interests" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.interests.title")}</h1>
            <p className="mt-3 text-ink-soft">{t("ob.interests.hint")}</p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {INTERESTS.map((i) => {
                const on = s.interests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set("interests", on ? s.interests.filter((x) => x !== i) : [...s.interests, i])
                    }
                    className={`rounded-full px-5 py-3 text-sm font-semibold ring-1 transition-[background-color,transform] duration-200 active:scale-95 ${
                      on ? "bg-accent text-accent-ink ring-accent" : "bg-surface ring-line hover:bg-surface-2"
                    }`}
                  >
                    {t(`interest.${i}` as MessageKey)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "goal" && (
          <>
            <p className="font-serif text-lg italic text-highlight">“{t("brand.motto")}”</p>
            <h1 className="mt-3 font-serif text-3xl sm:text-4xl">{t("ob.goal.title")}</h1>
            <p className="mt-3 text-ink-soft">{t("ob.goal.hint")}</p>
            <textarea
              className="field mt-7 h-40 resize-none py-4 leading-relaxed"
              maxLength={1000}
              autoFocus
              placeholder={t("ob.goal.placeholder")}
              value={s.goal}
              onChange={(e) => set("goal", e.target.value)}
            />
          </>
        )}

        {step === "plan" && (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl">{t("ob.plan.title")}</h1>
            <p className="mt-3 text-ink-soft">{t("ob.plan.hint")}</p>
            <ol className="mt-7 space-y-2">
              {(plan ?? []).map((p, i) => {
                const off = removed.has(i);
                return (
                  <li
                    key={i}
                    className={`animate-rise flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line transition-opacity ${
                      off ? "opacity-40" : ""
                    }`}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <span className="w-12 shrink-0 text-xs font-bold tabular-nums text-ink-faint">{hm(p.start_time)}</span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-highlight">
                      <ItemIcon name={p.icon ?? "sparkle"} className="h-4 w-4" />
                    </span>
                    <span className={`flex-1 text-sm font-semibold ${off ? "line-through" : ""}`}>
                      {p.title}
                      {p.duration_min ? (
                        <span className="ml-1.5 font-medium text-ink-faint">
                          · {p.duration_min} {t("common.min")}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRemoved((prev) => {
                          const n = new Set(prev);
                          if (n.has(i)) n.delete(i);
                          else n.add(i);
                          return n;
                        })
                      }
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
                      aria-label={t("common.delete")}
                    >
                      {off ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {step === "notify" && (
          <div className="pt-6 text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-surface-2 text-highlight">
              <ItemIcon name="alarm" className="h-9 w-9" />
            </span>
            <h1 className="mt-6 font-serif text-3xl sm:text-4xl">{t("ob.notify.title")}</h1>
            <p className="mx-auto mt-4 max-w-sm leading-relaxed text-ink-soft">{t("ob.notify.text")}</p>
          </div>
        )}
      </section>

      <footer className="sticky bottom-0 -mx-4 space-y-3 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pb-6 pt-4 sm:-mx-6 sm:px-6">
        <FormMessage kind="error">{error}</FormMessage>
        {step === "notify" ? (
          <div className="grid gap-3">
            <button className="btn-primary w-full" onClick={allowNotifications} disabled={busy}>
              {t("ob.notify.allow")}
            </button>
            <button className="btn-ghost w-full" onClick={next} disabled={busy}>
              {t("ob.notify.later")}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            {index > 0 && step !== "plan" && (
              <button className="btn-ghost px-5" onClick={() => setStep(STEPS[index - 1])} disabled={busy}>
                {t("common.back")}
              </button>
            )}
            <button className="btn-primary flex-1" onClick={next} disabled={!canNext || busy}>
              {busy && step === "goal" ? t("ob.plan.loading") : step === "plan" ? t("ob.plan.accept") : t("common.next")}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

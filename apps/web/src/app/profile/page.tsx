"use client";

import { Camera, LocateFixed, Shield, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { api, setTokens, type Me, type TokenPair } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { LANGS, useI18n, type MessageKey } from "@/lib/i18n";
import { uploadFile } from "@/lib/upload";
import { applyTheme, type ThemePref } from "@/lib/theme";
import { hm, PRAYERS } from "@/lib/types";

const USER_TYPES = ["university_student", "school_pupil", "worker", "freelancer", "entrepreneur", "other"] as const;
const INTERESTS = ["reading", "sport", "language", "quran", "programming", "math", "study", "health", "sleep"] as const;
const METHODS = ["muslim_world_league", "isna", "egypt", "karachi", "umm_al_qura", "tehran", "turkey"];
const METHOD_LABEL: Record<string, string> = {
  muslim_world_league: "Muslim World League",
  isna: "ISNA",
  egypt: "Egypt",
  karachi: "Karachi",
  umm_al_qura: "Umm al-Qura",
  tehran: "Tehran",
  turkey: "Diyanet",
};

type P = Me["profile"] & {
  user_type: string | null;
  birth_year: number | null;
  wake_time: string | null;
  sleep_time: string | null;
  evening_summary_time: string | null;
  prays: boolean;
  prayer_method: string;
  madhab: "hanafi" | "shafi";
  prayer_offsets: Record<string, number>;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  interests: string[];
  privacy: "public" | "friends" | "private";
  goal_reminder_freq: "daily" | "every_3_days" | "weekly" | "off";
  gender: "male" | "female" | "unspecified";
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card animate-rise p-5 sm:p-6">
      <h2 className="mb-5 font-serif text-xl">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Bitta input — `<label>`; tugmalar guruhi (`group`) — `role="group"` (aks holda tugma nomlari buziladi). */
function Row({ label, group, children }: { label: string; group?: boolean; children: React.ReactNode }) {
  const caption = <span className="mb-2 block text-sm font-semibold text-ink-soft">{label}</span>;
  if (group) {
    return (
      <div role="group" aria-label={label}>
        {caption}
        {children}
      </div>
    );
  }
  return (
    <label className="block">
      {caption}
      {children}
    </label>
  );
}

function Pills<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
            value === o.v ? "bg-accent text-accent-ink ring-accent" : "ring-line hover:bg-surface-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProfileView() {
  const { t, setLang, lang } = useI18n();
  const { me, refreshMe, logout } = useAuth();
  const router = useRouter();
  const [p, setP] = useState<P | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<P>>({});

  useEffect(() => {
    // Saqlanmagan o'zgarishlar bo'lsa, server javobi ularni bosib ketmasin
    if (me && Object.keys(pending.current).length === 0) setP(me.profile as P);
  }, [me]);

  /** O'zgarishlar yig'iladi va 600 ms jimlikdan keyin bitta so'rov bilan saqlanadi. */
  function update(patch: Partial<P>) {
    if (!p) return;
    setP((prev) => (prev ? { ...prev, ...patch } : prev));
    pending.current = { ...pending.current, ...patch };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const body = pending.current;
      pending.current = {};
      try {
        await api<Me>("/api/v1/me/profile", { method: "PATCH", auth: true, body });
        setError("");
        setSavedAt(Date.now());
        await refreshMe();
      } catch (err) {
        setError(errorText(err, t));
      }
    }, 600);
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError("");
    try {
      await uploadFile("/api/v1/me/avatar", file);
      await refreshMe();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setUploading(false);
    }
  }

  if (!me || !p) return null;
  const initials = me.profile.full_name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const justSaved = Date.now() - savedAt < 2500;

  return (
    <div className="space-y-4">
      {/* Eng tepada — "Don't forget why you started!" */}
      <section className="animate-rise overflow-hidden rounded-3xl bg-espresso text-cream shadow-soft">
        <div className="px-6 pb-7 pt-8 sm:px-8">
          <p className="font-serif text-3xl leading-tight sm:text-4xl">“{t("brand.motto")}”</p>
          <textarea
            className="mt-5 w-full resize-none rounded-2xl bg-cream/8 px-4 py-3 font-serif text-lg leading-snug text-cream outline-none ring-1 ring-cream/15 placeholder:text-cream/40 focus:ring-2 focus:ring-caramel"
            rows={3}
            maxLength={1000}
            aria-label={t("profile.goal")}
            placeholder={t("ob.goal.placeholder")}
            value={p.main_goal ?? ""}
            onChange={(e) => update({ main_goal: e.target.value })}
          />
        </div>
      </section>

      <section className="card animate-rise flex items-center gap-5 p-5 sm:p-6">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-serif text-2xl text-highlight ring-1 ring-line"
          aria-label={t("profile.photo")}
        >
          {me.profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
          <span className={`absolute inset-0 grid place-items-center bg-espresso/55 text-cream transition-opacity ${uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <Camera className={`h-6 w-6 ${uploading ? "animate-pulse" : ""}`} />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar(f);
            e.target.value = "";
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-2xl">{me.profile.full_name}</p>
          <p className="truncate text-sm text-ink-faint">{me.email}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
            <button className="text-highlight hover:underline" onClick={() => fileRef.current?.click()}>
              {t("profile.photo")}
            </button>
            {me.profile.avatar_url && (
              <button
                className="text-ink-faint hover:text-ink"
                onClick={async () => {
                  await api("/api/v1/me/avatar", { method: "DELETE", auth: true }).catch(() => {});
                  await refreshMe();
                }}
              >
                {t("profile.removePhoto")}
              </button>
            )}
          </div>
        </div>
        {(me.role === "admin" || me.role === "super_admin") && (
          <Link href="/admin" className="btn-ghost hidden h-10 px-4 text-sm sm:inline-flex">
            <Shield className="h-4 w-4" /> {t("profile.admin")}
          </Link>
        )}
      </section>

      <div className="sticky top-16 z-20 flex h-0 justify-end">
        <span
          className={`mt-2 rounded-full bg-espresso px-3 py-1 text-xs font-bold text-cream transition-opacity ${justSaved ? "opacity-100" : "opacity-0"}`}
          role="status"
        >
          ✓ {t("profile.saved")}
        </span>
      </div>
      {error && <FormMessage kind="error">{error}</FormMessage>}

      <Section title={t("profile.personal")}>
        <Row label={t("auth.name")}>
          <input className="field" maxLength={120} value={p.full_name} onChange={(e) => e.target.value.trim() && update({ full_name: e.target.value })} />
        </Row>
        <Row label={t("ob.who.title")}>
          <select className="field" value={p.user_type ?? ""} onChange={(e) => update({ user_type: e.target.value })}>
            {USER_TYPES.map((u) => (
              <option key={u} value={u}>
                {t(`ob.who.${u}` as MessageKey)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("ob.age.hint")}>
          <input
            className="field"
            inputMode="numeric"
            maxLength={4}
            defaultValue={p.birth_year ?? ""}
            onBlur={(e) => {
              const y = Number(e.target.value);
              if (y >= 1930 && y <= new Date().getFullYear() - 6) update({ birth_year: y });
            }}
          />
        </Row>
      </Section>

      <Section title={t("profile.day")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Row label={t("ob.sleep.wake")}>
            <input type="time" className="field" value={hm(p.wake_time)} onChange={(e) => update({ wake_time: e.target.value })} />
          </Row>
          <Row label={t("ob.sleep.sleep")}>
            <input type="time" className="field" value={hm(p.sleep_time)} onChange={(e) => update({ sleep_time: e.target.value })} />
          </Row>
          <Row label={t("profile.evening")}>
            <input
              type="time"
              className="field"
              value={hm(p.evening_summary_time)}
              onChange={(e) => update({ evening_summary_time: e.target.value })}
            />
          </Row>
        </div>
        <Row group label={t("profile.reminders")}>
          <Pills
            value={p.goal_reminder_freq}
            onChange={(v) => update({ goal_reminder_freq: v })}
            options={(["daily", "every_3_days", "weekly", "off"] as const).map((v) => ({ v, label: t(`profile.rem.${v}` as MessageKey) }))}
          />
        </Row>
      </Section>

      <Section title={t("profile.prayer")}>
        <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
          <span className="text-sm font-semibold">{t("profile.prays")}</span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--caramel)]" checked={p.prays} onChange={(e) => update({ prays: e.target.checked })} />
        </label>
        {p.prays && (
          <>
            <Row label={t("profile.method")}>
              <select className="field" value={p.prayer_method} onChange={(e) => update({ prayer_method: e.target.value })}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </Row>
            <Row group label={t("profile.madhab")}>
              <Pills
                value={p.madhab}
                onChange={(v) => update({ madhab: v })}
                options={[
                  { v: "hanafi", label: t("profile.hanafi") },
                  { v: "shafi", label: t("profile.shafi") },
                ]}
              />
            </Row>
            <div>
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("profile.offsets")}</span>
              <div className="grid grid-cols-5 gap-2">
                {PRAYERS.map((name) => (
                  <label key={name} className="block text-center">
                    <span className="mb-1 block truncate text-[11px] font-bold text-ink-faint">{t(`prayer.${name}` as MessageKey)}</span>
                    <input
                      className="field px-1 text-center"
                      inputMode="numeric"
                      value={p.prayer_offsets?.[name] ?? 0}
                      onChange={(e) => {
                        const n = Math.max(-30, Math.min(30, Number(e.target.value.replace(/[^\d-]/g, "")) || 0));
                        update({ prayer_offsets: { ...p.prayer_offsets, [name]: n } });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title={t("profile.location")}>
        <p className="text-sm text-ink-soft">
          {p.city ?? (p.latitude != null ? `${Number(p.latitude).toFixed(3)}, ${Number(p.longitude).toFixed(3)}` : "—")}
        </p>
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={() =>
            navigator.geolocation?.getCurrentPosition((pos) =>
              update({
                latitude: Math.round(pos.coords.latitude * 1e4) / 1e4,
                longitude: Math.round(pos.coords.longitude * 1e4) / 1e4,
                city: null,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              } as Partial<P>),
            )
          }
        >
          <LocateFixed className="h-4 w-4" /> {t("ob.place.detect")}
        </button>
      </Section>

      <Section title={t("profile.interests")}>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = p.interests.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() => update({ interests: on ? p.interests.filter((x) => x !== i) : [...p.interests, i] })}
                className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
                  on ? "bg-accent text-accent-ink ring-accent" : "ring-line hover:bg-surface-2"
                }`}
              >
                {t(`interest.${i}` as MessageKey)}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t("profile.appearance")}>
        <Row group label={t("profile.language")}>
          <Pills
            value={lang}
            onChange={(v) => {
              setLang(v);
              update({ language: v });
            }}
            options={LANGS.map((l) => ({ v: l.code, label: l.label }))}
          />
        </Row>
        <Row group label={t("profile.theme")}>
          <Pills
            value={p.theme as ThemePref}
            onChange={(v) => {
              applyTheme(v);
              update({ theme: v });
            }}
            options={(["system", "light", "dark"] as const).map((v) => ({ v, label: t(`profile.theme.${v}` as MessageKey) }))}
          />
        </Row>
      </Section>

      <Section title={t("profile.privacy")}>
        <Pills
          value={p.privacy}
          onChange={(v) => update({ privacy: v })}
          options={(["public", "friends", "private"] as const).map((v) => ({ v, label: t(`profile.privacy.${v}` as MessageKey) }))}
        />
        <p className="text-xs text-ink-faint">{t("profile.privacyHint")}</p>
      </Section>

      <Section title={t("profile.security")}>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPwMsg(null);
            try {
              const tokens = await api<TokenPair>("/api/v1/auth/change-password", {
                method: "POST",
                auth: true,
                body: { current_password: me.has_password ? pw.current : null, new_password: pw.next },
              });
              setTokens(tokens);
              setPw({ current: "", next: "" });
              setPwMsg({ kind: "success", text: t("profile.passwordChanged") });
            } catch (err) {
              setPwMsg({ kind: "error", text: errorText(err, t) });
            }
          }}
        >
          {me.has_password && (
            <input
              type="password"
              className="field"
              autoComplete="current-password"
              placeholder={t("profile.currentPassword")}
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              required
            />
          )}
          <input
            type="password"
            className="field"
            autoComplete="new-password"
            placeholder={t("auth.newPassword")}
            minLength={8}
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            required
          />
          {pwMsg && <FormMessage kind={pwMsg.kind}>{pwMsg.text}</FormMessage>}
          <button className="btn-ghost w-full">{t("profile.changePassword")}</button>
        </form>
        <button
          className="btn-ghost w-full"
          onClick={async () => {
            await api("/api/v1/auth/logout-all", { method: "POST", auth: true }).catch(() => {});
            await logout();
            router.replace("/login");
          }}
        >
          {t("profile.logoutAll")}
        </button>
      </Section>

      <section className="animate-rise rounded-3xl p-5 ring-1 ring-danger/30 sm:p-6">
        <h2 className="font-serif text-xl text-danger">{t("profile.danger")}</h2>
        <p className="mt-2 text-sm text-ink-soft">{t("profile.dangerText")}</p>
        <button
          className="btn mt-4 w-full bg-danger/10 text-danger hover:bg-danger/15"
          onClick={async () => {
            if (!window.confirm(t("profile.deleteConfirm"))) return;
            await api("/api/v1/me", { method: "DELETE", auth: true }).catch(() => {});
            await logout();
            router.replace("/");
          }}
        >
          <Trash2 className="h-4 w-4" /> {t("profile.danger")}
        </button>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileView />
    </AppShell>
  );
}

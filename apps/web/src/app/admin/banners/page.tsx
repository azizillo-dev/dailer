"use client";

import { BarChart3, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { I18nFields, type I18nText } from "@/components/admin/I18nFields";
import { FormMessage } from "@/components/AuthShell";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { uploadFile } from "@/lib/upload";

type Banner = {
  id: string;
  kind: "ad" | "news" | "announcement" | "motivation";
  title: I18nText;
  subtitle: I18nText;
  cta: I18nText;
  image_mobile_url: string | null;
  image_desktop_url: string | null;
  link_url: string | null;
  placement: "home_top" | "motivations" | "profile" | "stats";
  audience: { languages?: string[]; user_types?: string[]; platforms?: string[] };
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  is_active: boolean;
};

type Stats = { impressions: number; clicks: number; ctr: number | null; unique_viewers: number; days: { date: string; impression: number; click: number }[] };

const KINDS = { news: "Yangilik", announcement: "E'lon", ad: "Reklama", motivation: "Motivatsiya" };
const PLACEMENTS = { home_top: "Bugun (tepada)", motivations: "Motivatsiyalar", profile: "Profil", stats: "Statistika" };
const AUD = {
  languages: { uz: "O'zbekcha", ru: "Ruscha", en: "Inglizcha" },
  user_types: {
    university_student: "Talaba",
    school_pupil: "O'quvchi",
    worker: "Ishchi",
    freelancer: "Frilanser",
    entrepreneur: "Tadbirkor",
    other: "Boshqa",
  },
  platforms: { web: "Web", android: "Android", ios: "iOS" },
} as const;

type Draft = Omit<Banner, "id" | "starts_at" | "ends_at"> & { starts_at: string; ends_at: string };
const EMPTY: Draft = {
  kind: "news",
  title: {},
  subtitle: {},
  cta: {},
  image_mobile_url: null,
  image_desktop_url: null,
  link_url: "",
  placement: "home_top",
  audience: {},
  starts_at: "",
  ends_at: "",
  priority: 0,
  is_active: true,
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function status(b: Banner) {
  const n = Date.now();
  if (!b.is_active) return { label: "O'chiq", cls: "bg-surface-2 text-ink-soft" };
  if (b.starts_at && new Date(b.starts_at).getTime() > n) return { label: "Rejalashtirilgan", cls: "bg-highlight/20 text-highlight" };
  if (b.ends_at && new Date(b.ends_at).getTime() <= n) return { label: "Tugagan", cls: "bg-surface-2 text-ink-faint" };
  return { label: "Ko'rsatilmoqda", cls: "bg-success/12 text-success" };
}

function ImagePick({ label, value, onChange }: { label: string; value: string | null; onChange: (url: string | null) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <span className="mb-2 block text-sm font-semibold text-ink-soft">{label}</span>
      <label className="relative grid aspect-[16/7] cursor-pointer place-items-center overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs font-semibold text-ink-faint">
            <ImagePlus className={`h-6 w-6 ${busy ? "animate-pulse" : ""}`} /> Rasm tanlash
          </span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            setError("");
            try {
              const r = await uploadFile<{ url: string }>("/api/v1/admin/uploads?folder=banners", f);
              onChange(r.url);
            } catch (err) {
              setError(errorText(err, t));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {value && (
        <button type="button" className="mt-1 text-xs font-semibold text-ink-faint hover:text-ink" onClick={() => onChange(null)}>
          Olib tashlash
        </button>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function AdminBanners() {
  const { t } = useI18n();
  const [items, setItems] = useState<Banner[]>([]);
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [stats, setStats] = useState<{ banner: Banner; data: Stats } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setItems(await api<Banner[]>("/api/v1/admin/banners", { auth: true })), []);
  useEffect(() => {
    load().catch((e) => setError(errorText(e, t)));
  }, [load, t]);

  function open(b: Banner | "new") {
    setError("");
    setEditing(b);
    setDraft(b === "new" ? EMPTY : { ...b, link_url: b.link_url ?? "", starts_at: toLocalInput(b.starts_at), ends_at: toLocalInput(b.ends_at) });
  }

  function toggleAud(key: keyof typeof AUD, value: string) {
    const cur = new Set(draft.audience[key] ?? []);
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    setDraft({ ...draft, audience: { ...draft.audience, [key]: [...cur] } });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      ...draft,
      link_url: draft.link_url?.trim() || null,
      starts_at: fromLocalInput(draft.starts_at),
      ends_at: fromLocalInput(draft.ends_at),
      audience: {
        languages: draft.audience.languages ?? [],
        user_types: draft.audience.user_types ?? [],
        platforms: draft.audience.platforms ?? [],
      },
    };
    try {
      if (editing === "new") await api("/api/v1/admin/banners", { method: "POST", auth: true, body });
      else if (editing) await api(`/api/v1/admin/banners/${editing.id}`, { method: "PATCH", auth: true, body });
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl">Bannerlar</h1>
        <button className="btn-primary h-11 px-5 text-sm" onClick={() => open("new")}>
          + Yangi banner
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">Bannerlar ilova va saytda aylanib turadi. Auditoriya bo'sh bo'lsa — hammaga ko'rinadi.</p>
      {error && !editing && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((b) => {
          const s = status(b);
          return (
            <li key={b.id} className="card overflow-hidden p-0">
              <div className="relative aspect-[16/7] bg-gradient-to-br from-coffee to-espresso">
                {(b.image_desktop_url || b.image_mobile_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image_desktop_url || b.image_mobile_url || ""} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-espresso/80 to-transparent" />
                <p className="absolute inset-x-4 bottom-3 font-serif text-xl text-cream">{b.title.uz}</p>
                <span className={`absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] font-bold ${s.cls}`}>{s.label}</span>
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="truncate text-xs text-ink-faint">
                  {KINDS[b.kind]} · {PLACEMENTS[b.placement]} · ★{b.priority}
                </p>
                <div className="flex shrink-0 gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2"
                    aria-label="Statistika"
                    onClick={async () => setStats({ banner: b, data: await api<Stats>(`/api/v1/admin/banners/${b.id}/stats`, { auth: true }) })}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </button>
                  <button className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2" aria-label="Tahrirlash" onClick={() => open(b)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-full text-danger hover:bg-danger/10"
                    aria-label="O'chirish"
                    onClick={async () => {
                      if (!window.confirm("Banner o'chirilsinmi?")) return;
                      await api(`/api/v1/admin/banners/${b.id}`, { method: "DELETE", auth: true });
                      await load();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Yangi banner" : "Bannerni tahrirlash"}>
        <form onSubmit={save} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Turi</span>
              <select className="field" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Banner["kind"] })}>
                {Object.entries(KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Joylashuvi</span>
              <select className="field" value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as Banner["placement"] })}>
                {Object.entries(PLACEMENTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <I18nFields label="Sarlavha" value={draft.title} onChange={(title) => setDraft({ ...draft, title })} required maxLength={120} />
          <I18nFields label="Qisqa matn" value={draft.subtitle} onChange={(subtitle) => setDraft({ ...draft, subtitle })} maxLength={200} />
          <I18nFields label="Tugma matni" value={draft.cta} onChange={(cta) => setDraft({ ...draft, cta })} maxLength={40} />
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">Havola (https://… yoki /challenges)</span>
            <input className="field" value={draft.link_url ?? ""} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <ImagePick label="Rasm (kompyuter)" value={draft.image_desktop_url} onChange={(v) => setDraft({ ...draft, image_desktop_url: v })} />
            <ImagePick label="Rasm (telefon)" value={draft.image_mobile_url} onChange={(v) => setDraft({ ...draft, image_mobile_url: v })} />
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-semibold text-ink-soft">Auditoriya</legend>
            {(Object.keys(AUD) as (keyof typeof AUD)[]).map((key) => (
              <div key={key} className="flex flex-wrap gap-2">
                {Object.entries(AUD[key]).map(([v, label]) => {
                  const on = (draft.audience[key] ?? []).includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAud(key, v)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${on ? "bg-accent text-accent-ink ring-accent" : "ring-line"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ))}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Boshlanishi</span>
              <input type="datetime-local" className="field" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Tugashi</span>
              <input type="datetime-local" className="field" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Ustuvorlik</span>
              <input
                className="field"
                inputMode="numeric"
                value={draft.priority}
                onChange={(e) => setDraft({ ...draft, priority: Math.max(-100, Math.min(100, Number(e.target.value.replace(/[^\d-]/g, "")) || 0)) })}
              />
            </label>
            <label className="flex items-center justify-between self-end rounded-2xl bg-surface-2 px-4 py-3">
              <span className="text-sm font-semibold">Faol</span>
              <input type="checkbox" className="h-5 w-5 accent-[var(--caramel)]" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
            </label>
          </div>
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={busy || !draft.title.uz?.trim()}>
            Saqlash
          </button>
        </form>
      </Sheet>

      <Sheet open={stats !== null} onClose={() => setStats(null)} title={stats?.banner.title.uz}>
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Ko'rishlar", stats.data.impressions],
                ["Bosishlar", stats.data.clicks],
                ["CTR", stats.data.ctr == null ? "–" : `${stats.data.ctr}%`],
                ["Noyob", stats.data.unique_viewers],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-[11px] font-semibold text-ink-faint">{l}</p>
                  <p className="font-serif text-2xl">{v}</p>
                </div>
              ))}
            </div>
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-xs text-ink-faint">
                <tr>
                  <th className="py-1.5 font-semibold">Sana</th>
                  <th className="font-semibold">Ko'rish</th>
                  <th className="font-semibold">Bosish</th>
                </tr>
              </thead>
              <tbody>
                {stats.data.days.map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="py-1.5">{d.date}</td>
                    <td>{d.impression}</td>
                    <td>{d.click}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.data.days.length === 0 && <p className="text-sm text-ink-faint">Oxirgi 14 kunda ma'lumot yo'q.</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

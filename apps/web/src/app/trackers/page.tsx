"use client";

import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { ProgressRing } from "@/components/ProgressRing";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";

type Tab = "books" | "quran" | "dhikr";
type Book = { id: string; title: string; author: string | null; total_pages: number; current_page: number; status: string; percent: number; today_pages: number };
type Library = { books: Book[]; year: number; finished_this_year: number; pages_this_year: number; pages_last_7_days: number };
type Quran = {
  current_page: number;
  total_pages: number;
  khatm_count: number;
  daily_target_pages: number;
  today_pages: number;
  juz: number;
  days_to_khatm: number | null;
  week: { date: string; pages: number }[];
  khatm_completed?: boolean;
};
type Dhikr = { id: string; name: string; target: number; today: number };

function BooksTab() {
  const { t } = useI18n();
  const [lib, setLib] = useState<Library | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", total_pages: "", current_page: "" });
  const [pageInput, setPageInput] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(() => api<Library>("/api/v1/books", { auth: true }).then(setLib).catch(() => {}), []);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/v1/books", {
        method: "POST",
        auth: true,
        body: {
          title: form.title,
          author: form.author || null,
          total_pages: Number(form.total_pages),
          current_page: Number(form.current_page || 0),
        },
      });
      setOpen(false);
      setForm({ title: "", author: "", total_pages: "", current_page: "" });
      load();
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  async function progress(b: Book) {
    const v = pageInput[b.id];
    if (!v) return;
    await api(`/api/v1/books/${b.id}/progress`, { method: "POST", auth: true, body: { current_page: Number(v) } }).catch(() => {});
    setPageInput((p) => ({ ...p, [b.id]: "" }));
    load();
  }

  const reading = lib?.books.filter((b) => b.status !== "finished") ?? [];
  const finished = lib?.books.filter((b) => b.status === "finished") ?? [];

  return (
    <>
      {lib && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {t("tr.yearStats", { y: lib.year, b: lib.finished_this_year, p: lib.pages_this_year })} · {t("tr.week", { n: lib.pages_last_7_days })}
          </p>
          <button className="btn-primary h-10 px-4 text-sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t("tr.addBook")}
          </button>
        </div>
      )}
      {lib && lib.books.length === 0 && <p className="card mt-4 p-6 text-sm leading-relaxed text-ink-soft">{t("tr.noBooks")}</p>}
      <ul className="mt-4 space-y-3">
        {reading.map((b) => (
          <li key={b.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-xl">{b.title}</p>
                {b.author && <p className="truncate text-sm text-ink-faint">{b.author}</p>}
              </div>
              <p className="shrink-0 font-serif text-2xl">{b.percent}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full origin-left rounded-full bg-caramel transition-transform duration-500" style={{ transform: `scaleX(${b.percent / 100})` }} />
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              {t("tr.pageOf", { p: b.current_page, t: b.total_pages })}
              {b.today_pages > 0 && <span className="ml-2 font-bold text-success">{t("tr.todayPages", { n: b.today_pages })}</span>}
            </p>
            <div className="mt-4 flex gap-2">
              <input
                className="field h-11 flex-1"
                inputMode="numeric"
                placeholder={t("tr.updatePage")}
                value={pageInput[b.id] ?? ""}
                onChange={(e) => setPageInput((p) => ({ ...p, [b.id]: e.target.value.replace(/\D/g, "") }))}
                onKeyDown={(e) => e.key === "Enter" && progress(b)}
              />
              <button className="btn-primary h-11 px-5 text-sm" disabled={!pageInput[b.id]} onClick={() => progress(b)}>
                {t("ch.save")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {finished.length > 0 && (
        <>
          <h3 className="mt-8 text-sm font-bold uppercase tracking-widest text-ink-faint">{t("tr.finished")}</h3>
          <ul className="mt-3 space-y-2">
            {finished.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">✓ {b.title}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {b.author ? `${b.author} · ` : ""}
                    {b.total_pages}
                  </span>
                </span>
                <button
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint hover:text-danger"
                  aria-label={t("tr.delete")}
                  onClick={async () => {
                    await api(`/api/v1/books/${b.id}`, { method: "DELETE", auth: true });
                    load();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("tr.addBook")}>
        <form onSubmit={add} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("tr.bookTitle")}</span>
            <input className="field" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("tr.author")}</span>
            <input className="field" maxLength={120} value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("tr.pages")}</span>
              <input className="field" inputMode="numeric" required value={form.total_pages} onChange={(e) => setForm({ ...form, total_pages: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("tr.currentPage")}</span>
              <input className="field" inputMode="numeric" value={form.current_page} onChange={(e) => setForm({ ...form, current_page: e.target.value.replace(/\D/g, "") })} />
            </label>
          </div>
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <button className="btn-primary w-full" disabled={!form.title.trim() || !Number(form.total_pages)}>
            {t("ch.save")}
          </button>
        </form>
      </Sheet>
    </>
  );
}

function QuranTab() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState<Quran | null>(null);
  const [custom, setCustom] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    api<Quran>("/api/v1/quran", { auth: true }).then(setQ).catch(() => {});
  }, []);

  async function read(pages: number) {
    if (pages <= 0) return;
    const r = await api<Quran>("/api/v1/quran/read", { method: "POST", auth: true, body: { pages } }).catch(() => null);
    if (r) {
      setQ(r);
      if (r.khatm_completed) setCelebrate(true);
    }
  }

  if (!q) return null;
  const maxWeek = Math.max(1, q.daily_target_pages, ...q.week.map((w) => w.pages));
  return (
    <>
      {celebrate && (
        <p role="status" className="animate-rise mb-4 rounded-2xl bg-success/12 px-4 py-3 text-center font-semibold text-success">
          {t("tr.qKhatmDone")}
        </p>
      )}
      <div className="card flex flex-col items-center p-6 text-center">
        <ProgressRing value={q.current_page / q.total_pages} size={180} stroke={12}>
          <div>
            <p className="font-serif text-4xl">{Math.round((q.current_page / q.total_pages) * 100)}%</p>
            <p className="text-xs text-ink-faint">{t("tr.qPage", { p: q.current_page, t: q.total_pages, j: q.juz })}</p>
          </div>
        </ProgressRing>
        {q.khatm_count > 0 && <p className="mt-3 text-sm font-semibold text-highlight">{t("tr.qKhatm", { n: q.khatm_count })}</p>}
        <p className="mt-3 font-semibold">{t("tr.qToday", { n: q.today_pages, t: q.daily_target_pages })}</p>
        {q.days_to_khatm != null && <p className="text-xs text-ink-faint">{t("tr.qDays", { n: q.days_to_khatm })}</p>}
        <div className="mt-5 grid w-full max-w-sm grid-cols-4 gap-2">
          {[1, 2, 5, 10].map((n) => (
            <button key={n} className="btn-ghost h-11 px-0" onClick={() => read(n)}>
              +{n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex w-full max-w-sm gap-2">
          <input className="field h-11 flex-1" inputMode="numeric" placeholder="…" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} />
          <button
            className="btn-primary h-11 px-5 text-sm"
            disabled={!custom}
            onClick={() => {
              read(Number(custom));
              setCustom("");
            }}
          >
            {t("tr.qRead")}
          </button>
        </div>
      </div>
      <div className="card mt-3 p-5">
        <div className="flex h-24 items-end gap-2">
          {q.week.map((w) => (
            <div key={w.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${w.date}: ${w.pages}`}>
              <span className="w-full max-w-8 rounded-t-[4px] bg-caramel" style={{ height: w.pages ? `${Math.max(6, (w.pages / maxWeek) * 100)}%` : 2 }} />
              <span className="text-[10px] font-bold uppercase text-ink-faint">
                {new Date(`${w.date}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { weekday: "narrow" })}
              </span>
            </div>
          ))}
        </div>
        <label className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink-soft">{t("tr.qTarget")}</span>
          <input
            className="field h-10 w-20 text-center"
            inputMode="numeric"
            defaultValue={q.daily_target_pages}
            onBlur={async (e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v !== q.daily_target_pages) setQ(await api<Quran>("/api/v1/quran", { method: "PATCH", auth: true, body: { daily_target_pages: v } }));
            }}
          />
        </label>
      </div>
    </>
  );
}

function DhikrTab() {
  const { t } = useI18n();
  const [list, setList] = useState<Dhikr[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", target: "33" });
  const pending = useRef<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<Dhikr[]>("/api/v1/dhikr", { auth: true }).then(setList).catch(() => {});
  }, []);

  // Bosishlar to'planib, 1.5 soniyada bir yuboriladi
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const batch = pending.current;
    pending.current = {};
    for (const [id, count] of Object.entries(batch)) {
      if (count > 0) api(`/api/v1/dhikr/${id}/add`, { method: "POST", auth: true, body: { count } }).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  const d = list[active];
  function tap() {
    if (!d) return;
    const next = d.today + 1;
    setList((l) => l.map((x, i) => (i === active ? { ...x, today: next } : x)));
    pending.current[d.id] = (pending.current[d.id] ?? 0) + 1;
    try {
      navigator.vibrate?.(next === d.target ? [40, 60, 40] : 12);
    } catch {}
    timer.current ??= setTimeout(flush, 1500);
  }

  return (
    <>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {list.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 ${i === active ? "bg-accent text-accent-ink ring-accent" : "ring-line"}`}
          >
            {x.name} <span className="opacity-70">{x.today}</span>
          </button>
        ))}
        <button onClick={() => setOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-line" aria-label={t("tr.dAdd")}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {d && (
        <div className="mt-8 flex flex-col items-center">
          <p className="font-serif text-2xl">{d.name}</p>
          <button
            onClick={tap}
            className="relative mt-6 grid h-64 w-64 select-none place-items-center rounded-full bg-surface shadow-soft ring-1 ring-line transition-transform duration-100 active:scale-95 [-webkit-tap-highlight-color:transparent]"
            aria-label={`${t("tr.dTap")}: ${d.today}/${d.target}`}
          >
            <span className="absolute inset-2">
              <ProgressRing value={Math.min(1, d.today / d.target)} size={240} stroke={10} />
            </span>
            <span className="relative text-center">
              <span className="block font-serif text-7xl tabular-nums">{d.today}</span>
              <span className="block text-sm text-ink-faint">/ {d.target}</span>
            </span>
          </button>
          <p className={`mt-5 h-5 text-sm font-semibold ${d.today >= d.target ? "text-success" : "text-ink-faint"}`}>
            {d.today >= d.target ? `✓ ${t("tr.dDone")}` : t("tr.dTap")}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              className="btn-ghost h-10 px-4 text-sm"
              onClick={() => {
                flush();
                setActive((active + 1) % list.length);
              }}
            >
              <RotateCcw className="h-4 w-4" /> {t("tr.dReset")}
            </button>
            <button
              className="btn-ghost h-10 px-4 text-sm"
              disabled={!pending.current[d.id]}
              onClick={() => {
                if (!pending.current[d.id]) return;
                pending.current[d.id] -= 1;
                setList((l) => l.map((x, i) => (i === active ? { ...x, today: Math.max(0, x.today - 1) } : x)));
              }}
              aria-label="−1"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("tr.dAdd")}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await api<Dhikr[]>("/api/v1/dhikr", { method: "POST", auth: true, body: { name: form.name, target: Number(form.target) } }).catch(() => null);
            if (r) {
              setList(r);
              setActive(r.length - 1);
              setOpen(false);
              setForm({ name: "", target: "33" });
            }
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("tr.dName")}</span>
            <input className="field" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-ink-soft">{t("tr.dTarget")}</span>
            <input className="field" inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/\D/g, "") })} />
          </label>
          <button className="btn-primary w-full" disabled={!form.name.trim() || !Number(form.target)}>
            {t("ch.save")}
          </button>
        </form>
      </Sheet>
    </>
  );
}

function TrackersView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("books");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p === "quran" || p === "dhikr" || p === "books") setTab(p);
  }, []);
  return (
    <>
      <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{t("nav.trackers")}</h1>
      <div className="mt-5 flex gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line" role="tablist">
        {(["books", "quran", "dhikr"] as Tab[]).map((x) => (
          <button
            key={x}
            role="tab"
            aria-selected={tab === x}
            onClick={() => {
              setTab(x);
              window.history.replaceState(null, "", `?tab=${x}`);
            }}
            className={`h-10 flex-1 rounded-full text-sm font-bold transition-colors ${tab === x ? "bg-accent text-accent-ink" : "text-ink-soft"}`}
          >
            {t(`tr.${x}` as MessageKey)}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "books" && <BooksTab />}
        {tab === "quran" && <QuranTab />}
        {tab === "dhikr" && <DhikrTab />}
      </div>
    </>
  );
}

export default function TrackersPage() {
  return (
    <AppShell>
      <TrackersView />
    </AppShell>
  );
}

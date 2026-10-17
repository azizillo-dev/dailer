"use client";

import { ArrowUp, FileText, History, Plus, Sparkles, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { Sheet } from "@/components/Sheet";
import { streamChat } from "@/lib/ai-stream";
import { api } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n, type MessageKey } from "@/lib/i18n";

type Msg = { id?: string; role: "user" | "assistant"; content: string; provider?: string | null; rating?: number | null };
type Conv = { id: string; title: string; last_message_at: string };
type Report = { id: string; period_start: string; period_end: string; content: string; provider: string; created_at: string };
type Usage = { used: number; limit: number };

const QUICK: MessageKey[] = ["ai.q1", "ai.q2", "ai.q3", "ai.q4", "ai.q5"];

function AIView() {
  const { t, lang } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [history, setHistory] = useState<Conv[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadUsage = useCallback(() => api<Usage>("/api/v1/ai/usage", { auth: true }).then(setUsage).catch(() => {}), []);

  useEffect(() => {
    loadUsage();
    api<Report[]>("/api/v1/ai/reports", { auth: true }).then(setReports).catch(() => {});
  }, [loadUsage]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError("");
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      await streamChat(
        { message, conversation_id: convId },
        {
          onMeta: (d) => setConvId(d.conversation_id),
          onToken: (tok) =>
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + tok };
              return copy;
            }),
          onDone: (d) =>
            setMsgs((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { ...copy[copy.length - 1], id: d.message_id, provider: d.provider };
              return copy;
            }),
        },
      );
    } catch (err) {
      setMsgs((m) => m.slice(0, -1));
      setError(errorText(err, t));
    } finally {
      setBusy(false);
      loadUsage();
      inputRef.current?.focus();
    }
  }

  async function openConversation(id: string) {
    const c = await api<{ id: string; messages: Msg[] }>(`/api/v1/ai/conversations/${id}`, { auth: true });
    setConvId(c.id);
    setMsgs(c.messages);
    setShowHistory(false);
  }

  async function rate(m: Msg, value: 1 | -1) {
    if (!m.id) return;
    const next = m.rating === value ? 0 : value;
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, rating: next || null } : x)));
    await api(`/api/v1/ai/messages/${m.id}/rate`, { method: "POST", auth: true, body: { rating: next } }).catch(() => {});
  }

  async function getReport() {
    setReportBusy(true);
    setError("");
    try {
      const r = await api<Report>("/api/v1/ai/reports/weekly", { method: "POST", auth: true });
      setReport(r);
      setReports((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setReportBusy(false);
    }
  }

  const fmtRange = (r: Report) =>
    `${new Date(`${r.period_start}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { day: "numeric", month: "short" })} – ${new Date(`${r.period_end}T12:00:00`).toLocaleDateString(lang === "uz" ? "uz-Latn" : lang, { day: "numeric", month: "short" })}`;
  const limitReached = usage ? usage.used >= usage.limit : false;
  const thisWeek = reports[0] && Date.now() - new Date(reports[0].created_at).getTime() < 7 * 864e5 && reports[0].provider !== "template";

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{t("ai.title")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t("ai.subtitle")}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line"
            aria-label={t("ai.history")}
            title={t("ai.history")}
            onClick={async () => {
              setShowHistory(true);
              setHistory(await api<Conv[]>("/api/v1/ai/conversations", { auth: true }).catch(() => []));
            }}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line"
            aria-label={t("ai.newChat")}
            title={t("ai.newChat")}
            onClick={() => {
              setMsgs([]);
              setConvId(null);
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Haftalik hisobot */}
      <section className="mt-5 flex items-center gap-4 rounded-3xl bg-espresso p-5 text-cream">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cream/10 text-latte">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg">{t("ai.report")}</p>
          <p className="text-xs text-cream/70">{t("ai.reportHint")}</p>
        </div>
        <button
          className="btn h-10 shrink-0 bg-caramel px-4 text-sm text-espresso hover:opacity-90"
          disabled={reportBusy}
          onClick={() => (thisWeek ? setReport(reports[0]) : getReport())}
        >
          {reportBusy ? t("ai.generating") : thisWeek ? t("ai.reportOpen") : t("ai.reportGet")}
        </button>
      </section>

      {/* Suhbat */}
      <div className="mt-6 flex-1 space-y-4">
        {msgs.length === 0 && (
          <div className="animate-rise">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-highlight">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="card rounded-tl-md px-4 py-3 text-[15px] leading-relaxed">{t("ai.greeting")}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 pl-12">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => send(t(q))}
                  disabled={busy || limitReached}
                  className="rounded-full bg-surface px-4 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  {t(q)}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-tr-md bg-accent px-4 py-3 text-[15px] leading-relaxed text-accent-ink">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-highlight">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 max-w-[85%]">
                <div className="card whitespace-pre-wrap rounded-tl-md px-4 py-3 text-[15px] leading-relaxed">
                  {m.content || (
                    <span className="inline-flex gap-1" aria-label="…">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-2 w-2 animate-pulse rounded-full bg-ink-faint" style={{ animationDelay: `${d * 0.15}s` }} />
                      ))}
                    </span>
                  )}
                </div>
                {m.id && (
                  <div className="mt-1.5 flex items-center gap-1 pl-1 text-ink-faint">
                    <button
                      onClick={() => rate(m, 1)}
                      aria-label={t("ai.helpful")}
                      aria-pressed={m.rating === 1}
                      className={`grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 ${m.rating === 1 ? "text-success" : ""}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => rate(m, -1)}
                      aria-label={t("ai.notHelpful")}
                      aria-pressed={m.rating === -1}
                      className={`grid h-7 w-7 place-items-center rounded-full hover:bg-surface-2 ${m.rating === -1 ? "text-danger" : ""}`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    {m.provider === "template" && <span className="ml-1 text-[11px]">· {t("ai.template")}</span>}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>

      {error && (
        <div className="mt-4">
          <FormMessage kind="error">{error}</FormMessage>
        </div>
      )}

      {/* Kiritish */}
      <form
        className="sticky bottom-20 z-10 mt-6 md:bottom-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-[28px] bg-surface p-2 shadow-soft ring-1 ring-line focus-within:ring-2 focus-within:ring-highlight">
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={500}
            value={input}
            disabled={limitReached}
            placeholder={limitReached ? t("ai.limit") : t("ai.placeholder")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-ink-faint focus-visible:outline-none"
          />
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-transform active:scale-90 disabled:opacity-40"
            disabled={busy || !input.trim() || limitReached}
            aria-label={t("ai.send")}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        {usage && (
          <p className="mt-1.5 text-center text-[11px] font-semibold text-ink-faint">{t("ai.usage", { used: usage.used, limit: usage.limit })}</p>
        )}
      </form>

      <Sheet open={showHistory} onClose={() => setShowHistory(false)} title={t("ai.history")}>
        {history && history.length === 0 && <p className="text-ink-soft">{t("ai.noHistory")}</p>}
        <ul className="space-y-2">
          {history?.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <button
                className="min-w-0 flex-1 rounded-2xl px-4 py-3 text-left ring-1 ring-line hover:bg-surface-2"
                onClick={() => openConversation(c.id)}
              >
                <span className="block truncate text-sm font-semibold">{c.title || "…"}</span>
                <span className="block text-xs text-ink-faint">{new Date(c.last_message_at).toLocaleString(lang === "uz" ? "uz-Latn" : lang)}</span>
              </button>
              <button
                className="grid h-10 w-10 place-items-center rounded-full text-ink-faint hover:bg-danger/10 hover:text-danger"
                aria-label="×"
                onClick={async () => {
                  await api(`/api/v1/ai/conversations/${c.id}`, { method: "DELETE", auth: true }).catch(() => {});
                  setHistory((h) => h?.filter((x) => x.id !== c.id) ?? null);
                  if (convId === c.id) {
                    setMsgs([]);
                    setConvId(null);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={report !== null} onClose={() => setReport(null)} title={t("ai.report")}>
        {report && (
          <div>
            <p className="eyebrow">{fmtRange(report)}</p>
            <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{report.content}</div>
            {reports.length > 1 && (
              <>
                <p className="mt-8 text-sm font-semibold text-ink-soft">{t("ai.reports")}</p>
                <ul className="mt-2 space-y-1.5">
                  {reports
                    .filter((r) => r.id !== report.id)
                    .map((r) => (
                      <li key={r.id}>
                        <button className="w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-line hover:bg-surface-2" onClick={() => setReport(r)}>
                          {fmtRange(r)}
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function AIPage() {
  return (
    <AppShell>
      <AIView />
    </AppShell>
  );
}

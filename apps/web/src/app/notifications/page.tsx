"use client";

import { Bell, Flame, Moon, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PushToggle } from "@/components/PushToggle";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type N = { id: string; kind: string; title: string; body: string; data: { url?: string }; read: boolean; created_at: string };

const ICON: Record<string, typeof Bell> = { evening_summary: Moon, goal_reminder: Target, never_miss_twice: Flame };

function NotificationsView() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<N[] | null>(null);

  useEffect(() => {
    api<N[]>("/api/v1/notifications", { auth: true }).then(setItems).catch(() => setItems([]));
  }, []);

  async function open(n: N) {
    if (!n.read) {
      setItems((all) => all?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      await api(`/api/v1/notifications/${n.id}/read`, { method: "POST", auth: true }).catch(() => {});
      window.dispatchEvent(new Event("dailer:notifications"));
    }
    if (n.data?.url) router.push(n.data.url);
  }

  const unread = items?.some((n) => !n.read);

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">{t("notif.title")}</h1>
        {unread && (
          <button
            className="text-sm font-semibold text-highlight hover:underline"
            onClick={async () => {
              await api("/api/v1/notifications/read-all", { method: "POST", auth: true }).catch(() => {});
              setItems((all) => all?.map((x) => ({ ...x, read: true })) ?? null);
              window.dispatchEvent(new Event("dailer:notifications"));
            }}
          >
            {t("notif.readAll")}
          </button>
        )}
      </div>

      <div className="mt-6">
        <PushToggle />
      </div>

      {items && items.length === 0 && <p className="card mt-6 p-8 text-center text-ink-soft">{t("notif.empty")}</p>}
      <ul className="mt-6 space-y-2">
        {items?.map((n) => {
          const Icon = ICON[n.kind] ?? Bell;
          return (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                className={`flex w-full items-start gap-4 rounded-2xl px-4 py-4 text-left ring-1 transition-colors ${
                  n.read ? "bg-surface ring-line" : "bg-surface-2 ring-highlight/50"
                }`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface text-highlight ring-1 ring-line">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate ${n.read ? "font-semibold" : "font-bold"}`}>{n.title}</span>
                    <span className="shrink-0 text-[11px] text-ink-faint">
                      {new Date(n.created_at).toLocaleString(lang === "uz" ? "uz-Latn" : lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{n.body}</span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-highlight" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsView />
    </AppShell>
  );
}

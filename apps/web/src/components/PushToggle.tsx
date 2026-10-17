"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";

export function PushToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  if (state === null) return null;

  const hint =
    state === "denied" ? t("notif.denied") : state === "unsupported" ? t("notif.unsupported") : t("notif.pushHint");

  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-highlight">
        <BellRing className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {t("notif.push")} {state === "enabled" && <span className="ml-1 text-xs font-bold text-success">✓ {t("notif.enabled")}</span>}
        </p>
        <p className="text-xs leading-relaxed text-ink-faint">{hint}</p>
      </div>
      {(state === "enabled" || state === "disabled") && (
        <button
          className={state === "enabled" ? "btn-ghost h-10 shrink-0 px-4 text-sm" : "btn-primary h-10 shrink-0 px-4 text-sm"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setState(state === "enabled" ? await disablePush() : await enablePush());
            } catch {
              setState(await pushState());
            } finally {
              setBusy(false);
            }
          }}
        >
          {state === "enabled" ? t("notif.disable") : t("notif.enable")}
        </button>
      )}
    </div>
  );
}

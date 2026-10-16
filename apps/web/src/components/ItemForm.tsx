"use client";

import { useState } from "react";
import { FormMessage } from "./AuthShell";
import { ICONS, ItemIcon } from "./ItemIcon";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { ALL_DAYS, CATEGORIES, hm, PRAYERS, type Category, type ItemInput, type PrayerName, type RoutineItem } from "@/lib/types";

const ICON_NAMES = Object.keys(ICONS);

export type ItemDraft = {
  title: string;
  category: Category;
  icon: string;
  start_time: string;
  duration_min: string;
  days_of_week: number;
  prayer_name: PrayerName | "";
  prayer_offset_min: string;
  target_value: string;
  unit: string;
  min_version_text: string;
  reminder_enabled: boolean;
};

export function draftFrom(item?: Partial<RoutineItem>): ItemDraft {
  return {
    title: item?.title ?? "",
    category: item?.category ?? "custom",
    icon: item?.icon ?? "sparkle",
    start_time: hm(item?.start_time) || "",
    duration_min: item?.duration_min != null ? String(item.duration_min) : "",
    days_of_week: item?.days_of_week ?? ALL_DAYS,
    prayer_name: item?.time_from_prayer && item.prayer_name ? item.prayer_name : "",
    prayer_offset_min: item?.prayer_offset_min ? String(item.prayer_offset_min) : "0",
    target_value: item?.target_value != null ? String(Number(item.target_value)) : "",
    unit: item?.unit ?? "",
    min_version_text: item?.min_version_text ?? "",
    reminder_enabled: item?.reminder_enabled ?? true,
  };
}

export function draftToInput(d: ItemDraft): ItemInput {
  const linked = d.prayer_name !== "";
  return {
    title: d.title.trim(),
    category: d.category,
    icon: d.icon,
    start_time: linked ? null : d.start_time || null,
    duration_min: d.duration_min ? Number(d.duration_min) : null,
    days_of_week: d.days_of_week,
    prayer_name: linked ? (d.prayer_name as PrayerName) : null,
    time_from_prayer: linked,
    prayer_offset_min: linked ? Number(d.prayer_offset_min || 0) : 0,
    target_value: d.target_value ? Number(d.target_value) : null,
    unit: d.unit.trim() || null,
    min_version_text: d.min_version_text.trim() || null,
    reminder_enabled: d.reminder_enabled,
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-sm font-semibold text-ink-soft">{children}</span>;
}

export function ItemForm({
  initial,
  onSubmit,
  onDelete,
  error,
  busy,
}: {
  initial: ItemDraft;
  onSubmit: (d: ItemDraft) => void;
  onDelete?: () => void;
  error?: string;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const [d, setD] = useState(initial);
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(d);
      }}
    >
      <label className="block">
        <Label>{t("field.title")}</Label>
        <input className="field" required maxLength={120} value={d.title} onChange={(e) => set("title", e.target.value)} />
      </label>

      <div>
        <Label>{t("field.category")}</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("category", c)}
              className={`rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition-colors ${
                d.category === c ? "bg-accent text-accent-ink ring-accent" : "ring-line hover:bg-surface-2"
              }`}
            >
              {t(`cat.${c}` as MessageKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ICON_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => set("icon", name)}
            aria-pressed={d.icon === name}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${
              d.icon === name ? "bg-accent text-accent-ink ring-accent" : "text-ink-soft ring-line hover:bg-surface-2"
            }`}
          >
            <ItemIcon name={name} className="h-4 w-4" />
          </button>
        ))}
      </div>

      <label className="block">
        <Label>{t("field.prayer")}</Label>
        <select
          className="field"
          value={d.prayer_name}
          onChange={(e) => set("prayer_name", e.target.value as PrayerName | "")}
        >
          <option value="">{t("field.prayerNone")}</option>
          {PRAYERS.map((p) => (
            <option key={p} value={p}>
              {t(`prayer.${p}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        {d.prayer_name ? (
          <label className="block">
            <Label>{t("field.offset")}</Label>
            <input
              className="field"
              inputMode="numeric"
              value={d.prayer_offset_min}
              onChange={(e) => set("prayer_offset_min", e.target.value.replace(/[^\d-]/g, ""))}
            />
          </label>
        ) : (
          <label className="block">
            <Label>{t("field.time")}</Label>
            <input type="time" className="field" value={d.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </label>
        )}
        <label className="block">
          <Label>{t("field.duration")}</Label>
          <input
            className="field"
            inputMode="numeric"
            value={d.duration_min}
            onChange={(e) => set("duration_min", e.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>

      <div>
        <Label>{t("field.days")}</Label>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => {
            const on = (d.days_of_week & (1 << i)) !== 0;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = d.days_of_week ^ (1 << i);
                  if (next) set("days_of_week", next);
                }}
                className={`h-10 rounded-xl text-xs font-bold ring-1 transition-colors ${
                  on ? "bg-accent text-accent-ink ring-accent" : "text-ink-faint ring-line"
                }`}
              >
                {t(`day.${i}` as MessageKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <Label>{t("field.target")}</Label>
          <input
            className="field"
            inputMode="decimal"
            value={d.target_value}
            onChange={(e) => set("target_value", e.target.value.replace(/[^\d.]/g, ""))}
          />
        </label>
        <label className="block">
          <Label>{t("field.unit")}</Label>
          <input className="field" maxLength={24} value={d.unit} onChange={(e) => set("unit", e.target.value)} />
        </label>
      </div>

      <label className="block">
        <Label>{t("field.minVersion")}</Label>
        <input
          className="field"
          maxLength={120}
          value={d.min_version_text}
          onChange={(e) => set("min_version_text", e.target.value)}
        />
        <span className="mt-1.5 block text-xs text-ink-faint">{t("field.minVersionHint")}</span>
      </label>

      <label className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3">
        <span className="text-sm font-semibold">{t("field.reminder")}</span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--caramel)]"
          checked={d.reminder_enabled}
          onChange={(e) => set("reminder_enabled", e.target.checked)}
        />
      </label>

      {error && <FormMessage kind="error">{error}</FormMessage>}

      <div className="flex gap-3 pt-1">
        {onDelete && (
          <button type="button" className="btn-ghost px-5 text-danger" onClick={onDelete} disabled={busy}>
            {t("common.delete")}
          </button>
        )}
        <button className="btn-primary flex-1" disabled={busy || !d.title.trim()}>
          {t("common.save")}
        </button>
      </div>
    </form>
  );
}

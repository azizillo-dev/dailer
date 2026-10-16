export type Category =
  | "prayer"
  | "reading"
  | "sport"
  | "study"
  | "language"
  | "quran"
  | "dhikr"
  | "sleep"
  | "health"
  | "work"
  | "custom";

export const CATEGORIES: Category[] = [
  "prayer", "reading", "quran", "sport", "study", "language", "dhikr", "health", "work", "sleep", "custom",
];

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export const PRAYERS: PrayerName[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export type CheckinStatus = "done" | "partial" | "missed" | "excused";
export type ExcuseReason = "sick" | "travel" | "menstruation" | "other";

export type RoutineItem = {
  id: string;
  mode_id: string | null;
  template_id: string | null;
  title: string;
  category: Category;
  icon: string;
  color: string | null;
  start_time: string | null;
  duration_min: number | null;
  days_of_week: number;
  prayer_name: PrayerName | null;
  time_from_prayer: boolean;
  prayer_offset_min: number;
  target_value: number | null;
  unit: string | null;
  min_version_text: string | null;
  reminder_enabled: boolean;
  reminder_offset_min: number;
  sort_order: number;
  is_active: boolean;
};

export type ItemInput = Partial<Omit<RoutineItem, "id" | "sort_order" | "is_active">> & {
  title: string;
  category: Category;
  template_code?: string | null;
};

export type Checkin = {
  id: string;
  routine_item_id: string;
  date: string;
  status: CheckinStatus;
  excuse_reason: ExcuseReason | null;
  value: number | null;
  note: string | null;
};

export type Day = {
  date: string;
  prayer_times: Record<string, string>;
  items: { item: RoutineItem; time: string | null; checkin: Checkin | null }[];
  summary: {
    planned: number;
    done: number;
    partial: number;
    missed: number;
    excused: number;
    score: number | null;
  };
};

export type Template = {
  id: string;
  code: string;
  category: Category;
  title: Record<string, string>;
  description: Record<string, string>;
  icon: string;
  prayer_name: PrayerName | null;
  default_time: string | null;
  default_duration_min: number | null;
  default_target: number | null;
  unit: Record<string, string> | null;
  min_version: Record<string, string> | null;
};

export type PlanItem = ItemInput & { template_code: string | null; sort_order: number };

export const ALL_DAYS = 127;

/** "05:30:00" → "05:30" */
export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

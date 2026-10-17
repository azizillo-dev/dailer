import { Platform } from "react-native";
import { ScreenTimeNative } from "../../modules/screen-time";
import { api } from "./api";
import { prefs } from "./storage";

/** Android'da native modul bor (dev/production build) — ekran vaqti avtomatik yig'iladi. */
export const autoSupported = Platform.OS === "android" && ScreenTimeNative != null;

export function hasPermission(): boolean {
  try {
    return autoSupported && ScreenTimeNative!.hasPermission();
  } catch {
    return false;
  }
}

export function openPermissionSettings() {
  try {
    ScreenTimeNative?.openSettings();
  } catch {}
}

const LAST = "dailer.screen.lastSync";
const MIN_GAP_MS = 15 * 60_000;

/**
 * Oxirgi kunlarni telefondan o'qib serverga yuboradi.
 * Birinchi marta — 30 kun, keyin — 3 kun (kecha kech tungi foydalanish ham to'g'rilanadi).
 */
export async function syncScreenTime(force = false): Promise<boolean> {
  if (!hasPermission()) return false;
  const last = Number((await prefs.get(LAST)) ?? 0);
  if (!force && Date.now() - last < MIN_GAP_MS) return false;
  const days = await ScreenTimeNative!.getDays(last ? 3 : 30);
  if (!days.length) return false;
  await api("/api/v1/screen-time/days", {
    method: "PUT",
    auth: true,
    body: {
      source: "android",
      days: days.map((d) => ({ date: d.date, total_min: d.totalMin, pickups: d.pickups, apps: d.apps })),
    },
  });
  await prefs.set(LAST, String(Date.now()));
  return true;
}

export function fmtMinutes(min: number | null | undefined, units: { h: string; m: string }): string {
  if (min == null) return "–";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} ${units.m}`;
  return m ? `${h} ${units.h} ${m} ${units.m}` : `${h} ${units.h}`;
}

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";
import { translate } from "./i18n";

const CATEGORY = "task";
const DAYS_AHEAD = 7;
// iOS bir vaqtda 64 tagacha lokal eslatmani saqlaydi
const MAX_SCHEDULED = 60;

type DayItem = {
  item: { id: string; title: string; reminder_enabled: boolean; reminder_offset_min: number; category: string };
  time: string | null;
  checkin: { status: string } | null;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupCategories() {
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    {
      identifier: "done",
      buttonTitle: translate("notif.action.done"),
      // Ilovani ochmasdan — fonda belgilanadi
      options: { opensAppToForeground: false },
    },
  ]);
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("tasks", {
      name: "Kun tartibi",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: "#c08552",
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function at(date: string, time: string, minusMinutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm - minusMinutes, 0);
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Keyingi 7 kunlik eslatmalarni qaytadan rejalashtiradi (ilova ochilganda va kun tartibi o'zgarganda). */
export async function rescheduleWeek(): Promise<number> {
  if (Platform.OS === "web" || !(await Notifications.getPermissionsAsync()).granted) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  let count = 0;
  for (let i = 0; i < DAYS_AHEAD && count < MAX_SCHEDULED; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    const date = iso(day);
    let items: DayItem[] = [];
    try {
      items = (await api<{ items: DayItem[] }>(`/api/v1/today?date=${date}`, { auth: true })).items;
    } catch {
      // Kelajak kunlari uchun server check-in'ni rad etmaydi, lekin tarmoq bo'lmasa — o'tkazib yuboramiz
      continue;
    }
    for (const e of items) {
      if (count >= MAX_SCHEDULED) break;
      if (!e.time || !e.item.reminder_enabled || e.checkin) continue;
      const when = at(date, e.time, e.item.reminder_offset_min);
      if (when <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: e.item.title,
          body: translate("notif.reminder") + " · " + translate("motto"),
          data: { item_id: e.item.id, date, url: "/today" },
          categoryIdentifier: CATEGORY,
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: "tasks" },
      });
      count++;
    }
  }
  return count;
}

/** Vazifa belgilanganda uning shu kungi eslatmasi kerak emas. */
export async function cancelFor(itemId: string, date: string) {
  if (Platform.OS === "web") return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => {
        const d = n.content.data as { item_id?: string; date?: string };
        return d.item_id === itemId && d.date === date;
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** "Bajardim" tugmasi — ilova ochilmasdan check-in. */
export function listenForActions(onChange?: () => void) {
  if (Platform.OS === "web") return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(async (r) => {
    const data = r.notification.request.content.data as { item_id?: string; date?: string };
    if (r.actionIdentifier === "done" && data.item_id && data.date) {
      await api("/api/v1/checkins?source=notification", {
        method: "PUT",
        auth: true,
        body: { routine_item_id: data.item_id, date: data.date, status: "done" },
      }).catch(() => {});
      await Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => {});
      onChange?.();
    }
  });
  return () => sub.remove();
}

/** Server xabarlari (kechki xulosa, eslatmalar) uchun Expo push token. */
export async function registerPushToken(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return; // EAS loyihasi ulanmaguncha server push'i o'chiq (lokal eslatmalar ishlayveradi)
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/api/v1/me/devices", {
      method: "POST",
      auth: true,
      body: { platform: Platform.OS, push_token: token, app_version: Constants.expoConfig?.version },
    });
  } catch {
    // push ixtiyoriy
  }
}

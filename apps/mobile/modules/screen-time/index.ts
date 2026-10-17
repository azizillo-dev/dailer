import { requireOptionalNativeModule } from "expo";

export type NativeDay = {
  date: string;
  totalMin: number;
  pickups: number;
  apps: { id: string; name: string; minutes: number }[];
};

type ScreenTimeNative = {
  hasPermission(): boolean;
  openSettings(): void;
  getDays(days: number): Promise<NativeDay[]>;
};

/**
 * Android'dagi native modul. Expo Go va iOS/web'da yo'q — null qaytadi,
 * u holda ekran vaqti qo'lda kiritiladi.
 */
export const ScreenTimeNative = requireOptionalNativeModule<ScreenTimeNative>("ScreenTime");

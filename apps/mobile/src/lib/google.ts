import Constants from "expo-constants";
import { Platform } from "react-native";

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

/** Web Client ID — backend tokenni shu "audience" bilan tekshiradi (Android client ID faqat SHA-1 ro'yxati uchun). */
const WEB_CLIENT_ID = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId;

let mod: GoogleModule | null | undefined;

/** Native modul faqat dev/production build'da bor — Expo Go va web'da import xato beradi. */
function load(): GoogleModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = Platform.OS === "web" ? null : (require("@react-native-google-signin/google-signin") as GoogleModule);
    mod?.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  } catch {
    mod = null;
  }
  return mod;
}

export const googleAvailable = (): boolean => !!WEB_CLIENT_ID && !!load();

/** Google oynasini ochadi; bekor qilinsa — null. */
export async function googleIdToken(): Promise<string | null> {
  const m = load();
  if (!m || !WEB_CLIENT_ID) return null;
  await m.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  // Har safar akkaunt tanlash oynasi chiqsin (oldingi sessiya eslab qolinmasin)
  await m.GoogleSignin.signOut().catch(() => {});
  const res = await m.GoogleSignin.signIn();
  if (!m.isSuccessResponse(res)) return null;
  return res.data.idToken;
}

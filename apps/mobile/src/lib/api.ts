import Constants from "expo-constants";
import { Platform } from "react-native";
import { getLang } from "./i18n";
import { secure } from "./storage";

function resolveApiUrl(): string {
  // Ustuvorlik: EXPO_PUBLIC_API_URL → dev'da lokal server → production (app.json extra.apiUrl)
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const extra = Constants.expoConfig?.extra as { apiUrl?: string; devApiUrl?: string } | undefined;
  const url = fromEnv || (__DEV__ ? extra?.devApiUrl : extra?.apiUrl) || extra?.apiUrl || "http://localhost:8010";
  // Android emulyatorida kompyuterning localhost'i — 10.0.2.2
  return Platform.OS === "android" ? url.replace("localhost", "10.0.2.2") : url;
}

export const API_URL = resolveApiUrl();
/** Sayt manzili — admin panel va to'liq sozlamalar shu yerda. */
export const WEB_URL = (Constants.expoConfig?.extra as { webUrl?: string } | undefined)?.webUrl ?? "https://dailer-seven.vercel.app";
const TOKENS = "dailer.auth";

export type TokenPair = { access_token: string; refresh_token: string };
export type LoginResult = { tokens: TokenPair | null; requires_2fa: boolean; requires_2fa_setup: boolean; mfa_token: string | null };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let cached: TokenPair | null | undefined;

export async function getTokens(): Promise<TokenPair | null> {
  if (cached !== undefined) return cached;
  const raw = await secure.get(TOKENS);
  cached = raw ? (JSON.parse(raw) as TokenPair) : null;
  return cached;
}

export async function setTokens(t: TokenPair | null) {
  cached = t;
  await secure.set(TOKENS, t ? JSON.stringify(t) : null);
}

type Options = { method?: string; body?: unknown; auth?: boolean };

async function raw(path: string, { method = "GET", body, auth = false }: Options) {
  const headers: Record<string, string> = { "Accept-Language": getLang() };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = await getTokens();
    if (t) headers.Authorization = `Bearer ${t.access_token}`;
  }
  try {
    return await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "network", "");
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = await getTokens();
  if (!t) return false;
  refreshing ??= (async () => {
    try {
      const res = await raw("/api/v1/auth/refresh", { method: "POST", body: { refresh_token: t.refresh_token } });
      if (!res.ok) {
        await setTokens(null);
        return false;
      }
      await setTokens(await res.json());
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let res = await raw(path, options);
  if (res.status === 401 && options.auth && (await refresh())) res = await raw(path, options);
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "unknown", e.message ?? "");
  }
  return data as T;
}

export function errorText(err: unknown, fallback: string, network: string): string {
  if (err instanceof ApiError) {
    if (err.code === "network") return network;
    if (err.message) return err.message;
  }
  return fallback;
}

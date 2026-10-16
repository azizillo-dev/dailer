import { readStoredLang } from "./i18n";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
const TOKENS_KEY = "dailer.auth";

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type LoginResult = {
  tokens: TokenPair | null;
  requires_2fa: boolean;
  requires_2fa_setup: boolean;
  mfa_token: string | null;
};

export type Profile = {
  full_name: string;
  avatar_url: string | null;
  user_type: string | null;
  language: "uz" | "ru" | "en";
  theme: "system" | "light" | "dark";
  main_goal: string | null;
  onboarding_completed_at: string | null;
  [key: string]: unknown;
};

export type Me = {
  id: string;
  email: string;
  email_verified: boolean;
  role: "user" | "moderator" | "admin" | "super_admin";
  has_password: boolean;
  has_google: boolean;
  has_2fa: boolean;
  created_at: string;
  profile: Profile;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// --- Token saqlash ---
// Eslatma: web'da hozircha localStorage. Production'da refresh tokenni httpOnly cookie'ga
// ko'chirish rejalashtirilgan (API bir domenga chiqqanda).

export function getTokens(): TokenPair | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as TokenPair) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: TokenPair | null) {
  try {
    if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {}
}

// --- So'rovlar ---

type Options = { method?: string; body?: unknown; auth?: boolean };

async function rawRequest(path: string, { method = "GET", body, auth = false }: Options) {
  const headers: Record<string, string> = {
    "Accept-Language": readStoredLang(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const tokens = getTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.access_token}`;
  }
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "");
  }
}

// Bir vaqtda bir nechta so'rov 401 olsa, refresh faqat bir marta bajariladi
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const res = await rawRequest("/api/v1/auth/refresh", {
        method: "POST",
        body: { refresh_token: tokens.refresh_token },
      });
      if (!res.ok) {
        setTokens(null);
        return false;
      }
      setTokens((await res.json()) as TokenPair);
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let res = await rawRequest(path, options);
  if (res.status === 401 && options.auth && (await refreshTokens())) {
    res = await rawRequest(path, options);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? "unknown", err.message ?? "");
  }
  return data as T;
}

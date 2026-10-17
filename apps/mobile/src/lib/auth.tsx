import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getTokens, setTokens, type LoginResult, type TokenPair } from "./api";

export type Me = {
  id: string;
  email: string;
  email_verified: boolean;
  role: string;
  profile: {
    full_name: string;
    language: "uz" | "ru" | "en";
    main_goal: string | null;
    prays: boolean;
    onboarding_completed_at: string | null;
    avatar_url: string | null;
    [k: string]: unknown;
  };
};

type Ctx = {
  me: Me | null;
  loading: boolean;
  acceptLogin: (r: LoginResult) => Promise<boolean>;
  acceptTokens: (t: TokenPair) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!(await getTokens())) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<Me>("/api/v1/me", { auth: true }));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const acceptTokens = useCallback(
    async (t: TokenPair) => {
      await setTokens(t);
      await refreshMe();
    },
    [refreshMe],
  );

  const acceptLogin = useCallback(
    async (r: LoginResult) => {
      if (r.requires_2fa || !r.tokens) return false;
      await acceptTokens(r.tokens);
      return true;
    },
    [acceptTokens],
  );

  const logout = useCallback(async () => {
    const t = await getTokens();
    await setTokens(null);
    setMe(null);
    if (t) await api("/api/v1/auth/logout", { method: "POST", body: { refresh_token: t.refresh_token } }).catch(() => {});
  }, []);

  return <AuthContext.Provider value={{ me, loading, acceptLogin, acceptTokens, refreshMe, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getTokens, setTokens, type LoginResult, type Me, type TokenPair } from "./api";

const GOAL_KEY = "dailer.goal";

type AuthState = {
  me: Me | null;
  loading: boolean;
  /** Login/registratsiya natijasini qabul qiladi; 2FA kerak bo'lsa `false` qaytaradi. */
  acceptLogin: (result: LoginResult) => Promise<boolean>;
  acceptTokens: (tokens: TokenPair) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function rememberGoal(me: Me | null) {
  // Splash ekrani kirishdan oldin ham oliy maqsadni ko'rsata olishi uchun
  try {
    if (me?.profile.main_goal) localStorage.setItem(GOAL_KEY, me.profile.main_goal);
    else localStorage.removeItem(GOAL_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!getTokens()) {
      setMe(null);
      return;
    }
    try {
      const data = await api<Me>("/api/v1/me", { auth: true });
      setMe(data);
      rememberGoal(data);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const acceptTokens = useCallback(
    async (tokens: TokenPair) => {
      setTokens(tokens);
      await refreshMe();
    },
    [refreshMe],
  );

  const acceptLogin = useCallback(
    async (result: LoginResult) => {
      if (result.requires_2fa || !result.tokens) return false;
      await acceptTokens(result.tokens);
      return true;
    },
    [acceptTokens],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    setTokens(null);
    setMe(null);
    rememberGoal(null);
    if (tokens) {
      await api("/api/v1/auth/logout", {
        method: "POST",
        body: { refresh_token: tokens.refresh_token },
      }).catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, acceptLogin, acceptTokens, refreshMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

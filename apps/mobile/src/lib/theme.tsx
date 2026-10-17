import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { prefs } from "./storage";

/**
 * "Krem tong": yorqin krem fon, oppoq kartalar, jonli o'rik-amber urg'u, toza yashil "bajarildi".
 * Qorong'i rejim — jigarrang emas, iliq ko'mir. Standart holat — yorug' (profildan o'zgartiriladi).
 */
const light = {
  bg: "#fff8ef",
  surface: "#ffffff",
  surface2: "#fdeedd",
  ink: "#2a1f17",
  inkSoft: "#6e5b4c",
  inkFaint: "#a3907f",
  line: "#f1e3d2",
  accent: "#f28c45",
  accentInk: "#2a1f17",
  highlight: "#c4571e",
  success: "#2f9e6b",
  danger: "#d9483b",
  /** Eng to'q qatlam (motto kartasi) — yorug' fonda ham kontrast beradi. */
  deep: "#2a1f17",
  cream: "#fff8ef",
  caramel: "#f28c45",
  latte: "#f9dfc4",
  /** Urg'u rangining shaffof foni (chip, ikonka doirasi). */
  accentSoft: "rgba(242,140,69,0.14)",
  overlay: "rgba(42,31,23,0.45)",
};

const dark: typeof light = {
  bg: "#171411",
  surface: "#211d19",
  surface2: "#2b2621",
  ink: "#fff4e8",
  inkSoft: "#c9b8a6",
  inkFaint: "#8f8072",
  line: "#352e28",
  accent: "#ff9a52",
  accentInk: "#1a140f",
  highlight: "#ffae6e",
  success: "#4cc38a",
  danger: "#ff7a66",
  deep: "#0f0d0b",
  cream: "#fff4e8",
  caramel: "#ff9a52",
  latte: "#f9dfc4",
  accentSoft: "rgba(255,154,82,0.15)",
  overlay: "rgba(0,0,0,0.6)",
};

export type Palette = typeof light;
export type ThemeMode = "dark" | "light" | "system";

type Ctx = { mode: ThemeMode; scheme: "dark" | "light"; setMode: (m: ThemeMode) => void };
const ThemeCtx = createContext<Ctx>({ mode: "light", scheme: "light", setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  useEffect(() => {
    prefs.get("dailer.theme").then((v) => {
      if (v === "dark" || v === "light" || v === "system") setModeState(v);
    });
  }, []);
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    prefs.set("dailer.theme", m);
  }, []);
  const scheme = mode === "system" ? (system === "light" ? "light" : "dark") : mode;
  return <ThemeCtx.Provider value={{ mode, scheme, setMode }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

export function usePalette(): Palette {
  return useContext(ThemeCtx).scheme === "light" ? light : dark;
}

export const fonts = {
  serif: "Fraunces_500Medium",
  serifItalic: "Fraunces_400Regular_Italic",
  sans: "Manrope_500Medium",
  sansBold: "Manrope_700Bold",
  sansSemi: "Manrope_600SemiBold",
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 };

/** Keng ekranda (planshet, brauzer) kontent markazda shu kenglikdan oshmaydi. */
export const MAX_W = 760;
export const center = { width: "100%" as const, maxWidth: MAX_W, alignSelf: "center" as const };

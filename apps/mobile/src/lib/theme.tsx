import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { prefs } from "./storage";

/**
 * Asosiy ko'rinish — to'q espresso (qorong'i jigarrang) fon, karamel urg'u.
 * Yorug' (krem) rejim ham bor — profildan tanlanadi.
 */
const dark = {
  bg: "#2b1d14",
  surface: "#352419",
  surface2: "#3f2c1f",
  ink: "#f5ebdd",
  inkSoft: "#cbb59c",
  inkFaint: "#937b67",
  line: "#4a3527",
  accent: "#c9915e",
  accentInk: "#2b1d14",
  highlight: "#dba771",
  success: "#9cb784",
  danger: "#e3876b",
  /** Eng to'q qatlam (motto, tashqi ramka). */
  deep: "#1f140d",
  cream: "#f5ebdd",
  caramel: "#c9915e",
  latte: "#e8d5bc",
  /** Urg'u rangining shaffof foni (chip, ikonka doirasi). */
  accentSoft: "rgba(201,145,94,0.16)",
  overlay: "rgba(15,9,5,0.6)",
};

const light: typeof dark = {
  bg: "#f5ece0",
  surface: "#fffaf3",
  surface2: "#efe2d0",
  ink: "#2b1d14",
  inkSoft: "#6f5847",
  inkFaint: "#a08a77",
  line: "#e3d3bf",
  accent: "#4a3426",
  accentInk: "#f7f0e6",
  highlight: "#b07440",
  success: "#5d7a4a",
  danger: "#a5462f",
  deep: "#2b1d14",
  cream: "#f7f0e6",
  caramel: "#c08552",
  latte: "#e8d5bc",
  accentSoft: "rgba(192,133,82,0.14)",
  overlay: "rgba(43,29,20,0.45)",
};

export type Palette = typeof dark;
export type ThemeMode = "dark" | "light" | "system";

type Ctx = { mode: ThemeMode; scheme: "dark" | "light"; setMode: (m: ThemeMode) => void };
const ThemeCtx = createContext<Ctx>({ mode: "dark", scheme: "dark", setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
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

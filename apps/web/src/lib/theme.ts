export type ThemePref = "system" | "light" | "dark";

/** Mavzuni darhol qo'llaydi va keyingi ochilishlar uchun saqlaydi (layout'dagi boot skript o'qiydi). */
export function applyTheme(theme: ThemePref) {
  try {
    if (theme === "system") localStorage.removeItem("dailer.theme");
    else localStorage.setItem("dailer.theme", theme);
  } catch {}
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function storedTheme(): ThemePref {
  try {
    const v = localStorage.getItem("dailer.theme");
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

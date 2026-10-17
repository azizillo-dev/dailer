export type ThemePref = "system" | "light" | "dark";

const KEY = "dailer.theme";

/** "system" — OS mavzusiga qarab yorug'/qorong'i; CSS faqat data-theme ga qaraydi. */
function resolve(theme: ThemePref): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Mavzuni darhol qo'llaydi va keyingi ochilishlar uchun saqlaydi (layout'dagi boot skript o'qiydi). */
export function applyTheme(theme: ThemePref) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  document.documentElement.dataset.theme = resolve(theme);
}

/** Saqlangan tanlov; hech narsa tanlanmagan bo'lsa — null (standart: yorug'). */
export function storedTheme(): ThemePref | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {}
  return null;
}

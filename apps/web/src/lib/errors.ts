import { ApiError } from "./api";
import type { MessageKey } from "./i18n";

/** Server xabari (Accept-Language bo'yicha tarjima qilingan) yoki umumiy xabar. */
export function errorText(err: unknown, t: (k: MessageKey) => string): string {
  if (err instanceof ApiError) {
    if (err.code === "network") return t("error.network");
    if (err.message) return err.message;
  }
  return t("error.generic");
}

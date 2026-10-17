import { api, API_URL, ApiError, getTokens } from "./api";
import { readStoredLang } from "./i18n";

/** Multipart fayl yuborish (JSON klienti emas). 401 bo'lsa tokenni yangilab qayta urinadi. */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const send = () => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getTokens()?.access_token ?? ""}`, "Accept-Language": readStoredLang() },
      body: form,
    });
  };
  let res: Response;
  try {
    res = await send();
    if (res.status === 401) {
      await api("/api/v1/me", { auth: true }); // refresh
      res = await send();
    }
  } catch {
    throw new ApiError(0, "network", "");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "unknown", data?.error?.message ?? "");
  return data as T;
}

import { api, API_URL, ApiError, getTokens } from "./api";
import { readStoredLang } from "./i18n";

export type StreamHandlers = {
  onMeta?: (d: { conversation_id: string }) => void;
  onToken: (t: string) => void;
  onDone?: (d: { message_id: string; provider: string }) => void;
};

/** POST /ai/chat — SSE javobni bo'laklab o'qiydi. */
export async function streamChat(body: { message: string; conversation_id?: string | null }, h: StreamHandlers) {
  const send = () =>
    fetch(`${API_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Accept-Language": readStoredLang(),
        Authorization: `Bearer ${getTokens()?.access_token ?? ""}`,
      },
      body: JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await send();
    if (res.status === 401) {
      await api("/api/v1/me", { auth: true }); // tokenni yangilash
      res = await send();
    }
  } catch {
    throw new ApiError(0, "network", "");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error?.code ?? "unknown", data?.error?.message ?? "");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      const parsed = JSON.parse(data);
      if (event === "meta") h.onMeta?.(parsed);
      else if (event === "token") h.onToken(parsed.t);
      else if (event === "done") h.onDone?.(parsed);
    }
  }
}

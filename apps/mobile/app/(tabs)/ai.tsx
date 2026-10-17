import { fetch as expoFetch } from "expo/fetch";
import { ArrowUp, Sparkles } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Press, Text } from "@/components/ui";
import { api, API_URL, getTokens } from "@/lib/api";
import { getLang, useI18n } from "@/lib/i18n";
import { center, fonts, radius, usePalette } from "@/lib/theme";

type Msg = { role: "user" | "assistant"; content: string };

/** SSE: expo/fetch javob tanasini bo'laklab o'qiy oladi. */
async function stream(body: object, onToken: (t: string) => void, onMeta: (id: string) => void) {
  const tokens = await getTokens();
  const res = await expoFetch(`${API_URL}/api/v1/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Accept-Language": getLang(),
      Authorization: `Bearer ${tokens?.access_token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "error");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /event: (\w+)/.exec(block)?.[1];
      const data = /data: (.*)/.exec(block)?.[1];
      if (!ev || !data) continue;
      const parsed = JSON.parse(data);
      if (ev === "token") onToken(parsed.t);
      if (ev === "meta") onMeta(parsed.conversation_id);
    }
  }
}

export default function AI() {
  const { t } = useI18n();
  const c = usePalette();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conv, setConv] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const scroll = useRef<ScrollView>(null);

  const loadUsage = () => api<{ used: number; limit: number }>("/api/v1/ai/usage", { auth: true }).then(setUsage).catch(() => {});
  useEffect(() => {
    loadUsage();
  }, []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      await stream(
        { message, conversation_id: conv },
        (tok) =>
          setMsgs((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + tok };
            return copy;
          }),
        setConv,
      );
    } catch (e) {
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: e instanceof Error && e.message !== "error" ? e.message : t("common.error") };
        return copy;
      });
    } finally {
      setBusy(false);
      loadUsage();
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={[{ padding: 16, gap: 10 }, center]} showsVerticalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <Text variant="title">{t("ai.title")}</Text>
          {msgs.length === 0 && (
            <>
              <Bubble role="assistant" text={t("ai.greeting")} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingLeft: 36 }}>
                {(["ai.q1", "ai.q2", "ai.q3"] as const).map((q) => (
                  <Press key={q} onPress={() => send(t(q))} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.caramel, backgroundColor: c.accentSoft }}>
                    <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12.5, color: c.highlight }}>{t(q)}</Text>
                  </Press>
                ))}
              </View>
            </>
          )}
          {msgs.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.content || "…"} />
          ))}
        </ScrollView>
        <View style={{ padding: 10, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          <View style={[{ flexDirection: "row", alignItems: "flex-end", gap: 8 }, center]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t("ai.placeholder")}
              placeholderTextColor={c.inkFaint}
              multiline
              maxLength={500}
              style={[{ flex: 1, minHeight: 38, maxHeight: 110, borderRadius: 19, backgroundColor: c.bg, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, color: c.ink, fontFamily: fonts.sans, fontSize: 14 }, Platform.OS === "web" && ({ outlineStyle: "none" } as object)]}
            />
            <Press
              onPress={() => send(input)}
              disabled={busy || !input.trim()}
              accessibilityLabel="Send"
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: busy || !input.trim() ? 0.4 : 1 }}
            >
              <ArrowUp color={c.accentInk} size={17} />
            </Press>
          </View>
          {usage && (
            <Text variant="faint" style={{ textAlign: "center", marginTop: 6 }}>
              {t("ai.usage", { used: usage.used, limit: usage.limit })}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const c = usePalette();
  if (role === "user") {
    return (
      <View style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: c.accent, borderRadius: 18, borderTopRightRadius: 5, paddingHorizontal: 12, paddingVertical: 9 }}>
        <Text style={{ color: c.accentInk }}>{text}</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: 8, maxWidth: "92%" }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
        <Sparkles color={c.highlight} size={14} />
      </View>
      <View style={{ flexShrink: 1, backgroundColor: c.surface, borderRadius: 18, borderTopLeftRadius: 5, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: c.line }}>
        <Text>{text}</Text>
      </View>
    </View>
  );
}

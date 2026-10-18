import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Bell, ChevronRight, Globe, Languages, LogOut, Palette as PaletteIcon, Pencil, ShieldCheck } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, Platform, Text as RNText, TextInput, View } from "react-native";
import { Button, Card, Press, Screen, Segment, Text } from "@/components/ui";
import { api, WEB_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { ensurePermission, rescheduleWeek, setupCategories } from "@/lib/notifications";
import { fonts, radius, usePalette, useTheme, type ThemeMode } from "@/lib/theme";

export default function Profile() {
  const { t, lang, setLang } = useI18n();
  const c = usePalette();
  const { mode, setMode } = useTheme();
  const { me, logout, refreshMe } = useAuth();
  const [goal, setGoal] = useState(me?.profile.main_goal ?? "");
  const [editing, setEditing] = useState(false);
  const [notif, setNotif] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web") Notifications.getPermissionsAsync().then((p) => setNotif(p.granted));
    }, []),
  );

  async function saveGoal() {
    await api("/api/v1/me/profile", { method: "PATCH", auth: true, body: { main_goal: goal.trim() } }).catch(() => {});
    await refreshMe();
    setEditing(false);
  }

  async function changeLang(l: Lang) {
    setLang(l);
    await api("/api/v1/me/profile", { method: "PATCH", auth: true, body: { language: l } }).catch(() => {});
  }

  const name = me?.profile.full_name ?? "";
  return (
    <Screen>
      {/* Eng tepada — "Don't forget why you started!" */}
      <View style={{ backgroundColor: c.deep, borderRadius: radius.xl, padding: 16, gap: 10, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <RNText style={{ color: c.caramel, fontFamily: fonts.serifItalic, fontSize: 15 }}>“{t("motto")}”</RNText>
          {!editing && <PencilBtn onPress={() => setEditing(true)} />}
        </View>
        {editing ? (
          <>
            <TextInput
              value={goal}
              onChangeText={setGoal}
              multiline
              autoFocus
              maxLength={1000}
              placeholder={t("ob.goal")}
              placeholderTextColor={c.inkFaint}
              style={[
                { minHeight: 70, borderRadius: radius.md, backgroundColor: "rgba(245,235,221,0.06)", borderWidth: 1, borderColor: "rgba(245,235,221,0.14)", padding: 10, color: c.cream, fontFamily: fonts.serif, fontSize: 15, textAlignVertical: "top" },
                Platform.OS === "web" && ({ outlineStyle: "none" } as object),
              ]}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={t("common.save")} size="sm" onPress={saveGoal} style={{ flex: 1, backgroundColor: c.caramel }} />
            </View>
          </>
        ) : (
          <RNText style={{ color: c.cream, fontFamily: fonts.serif, fontSize: 17, lineHeight: 24 }}>{me?.profile.main_goal || t("ob.goal")}</RNText>
        )}
      </View>

      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {me?.profile.avatar_url ? (
            <Image source={{ uri: me.profile.avatar_url }} style={{ width: 44, height: 44 }} />
          ) : (
            <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: c.highlight }}>{name.slice(0, 1).toUpperCase()}</RNText>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="faint" numberOfLines={1}>
            {me?.email}
          </Text>
        </View>
      </Card>

      <Card padded={false}>
        <Setting icon={Languages} title={t("profile.language")}>
          <Segment<Lang>
            value={lang}
            onChange={changeLang}
            options={[
              { value: "uz", label: "O'zbek" },
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ]}
          />
        </Setting>
        <Divider />
        <Setting icon={PaletteIcon} title={t("profile.theme")}>
          <Segment<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "dark", label: t("theme.dark") },
              { value: "light", label: t("theme.light") },
              { value: "system", label: t("theme.system") },
            ]}
          />
        </Setting>
        {Platform.OS !== "web" && (
          <>
            <Divider />
            <LinkRow
              icon={Bell}
              title={t("profile.notifications")}
              value={notif ? t("profile.notifOn") : t("profile.notifOff")}
              onPress={
                notif
                  ? undefined
                  : async () => {
                      if (await ensurePermission()) {
                        await setupCategories();
                        await rescheduleWeek();
                        setNotif(true);
                      }
                    }
              }
            />
          </>
        )}
        <Divider />
        <LinkRow icon={Globe} title={t("profile.web")} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/profile`)} />
        {(me?.role === "admin" || me?.role === "super_admin") && (
          <>
            <Divider />
            {/* Admin panel — saytda (2FA bilan); ilova ichidagi brauzerda ochiladi */}
            <LinkRow icon={ShieldCheck} title={t("profile.admin")} value={t("profile.adminHint")} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/admin`)} />
          </>
        )}
      </Card>

      <Button
        title={t("profile.logout")}
        kind="danger"
        size="sm"
        icon={LogOut}
        style={{ alignSelf: "center", marginTop: 4 }}
        onPress={async () => {
          if (Platform.OS !== "web") await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
          await logout();
          router.replace("/login");
        }}
      />
    </Screen>
  );
}

function PencilBtn({ onPress }: { onPress: () => void }) {
  const c = usePalette();
  return (
    <Press onPress={onPress} accessibilityLabel="edit" style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(245,235,221,0.08)" }}>
      <Pencil color={c.cream} size={13} />
    </Press>
  );
}

function Divider() {
  const c = usePalette();
  return <View style={{ height: 1, backgroundColor: c.line, marginLeft: 46 }} />;
}

function Setting({ icon: Icon, title, children }: { icon: typeof Bell; title: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 24, alignItems: "center" }}>
          <Icon color={c.highlight} size={16} />
        </View>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5 }}>{title}</Text>
      </View>
      <View style={{ marginLeft: 34 }}>{children}</View>
    </View>
  );
}

function LinkRow({ icon: Icon, title, value, onPress }: { icon: typeof Bell; title: string; value?: string; onPress?: () => void }) {
  const c = usePalette();
  return (
    <Press onPress={onPress} haptic={false} disabled={!onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
      <View style={{ width: 24, alignItems: "center" }}>
        <Icon color={c.highlight} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13.5 }} numberOfLines={2}>
          {title}
        </Text>
        {value && <Text variant="faint">{value}</Text>}
      </View>
      {onPress && <ChevronRight color={c.inkFaint} size={16} />}
    </Press>
  );
}

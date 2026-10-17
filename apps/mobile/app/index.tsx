import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { usePalette } from "@/lib/theme";

export default function Index() {
  const { me, loading } = useAuth();
  const c = usePalette();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator color={c.highlight} />
      </View>
    );
  }
  if (!me) return <Redirect href="/login" />;
  if (!me.profile.onboarding_completed_at) return <Redirect href="/onboarding" />;
  return <Redirect href="/today" />;
}

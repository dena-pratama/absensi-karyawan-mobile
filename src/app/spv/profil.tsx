import Constants from "expo-constants";
import { useState } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { ThemeSetting } from "@/components/ThemeSetting";
import { ActionButton, Avatar, Card, CardTitle, kit, LoadingCard, Notice, TabScreen } from "@/components/kit";
import { useAuth } from "@/lib/auth";
import { useSpv } from "@/lib/spv";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { APP_ROLE_LABEL } from "@/shared/labels";
import { displayLogin } from "@/shared/login-id";

export default function SpvProfil() {
  const { session, signOut } = useAuth();
  const { branches, loading, error, refresh } = useSpv();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const username = displayLogin(session?.user.email ?? "");

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <TabScreen title="Profil" refreshing={refreshing} onRefresh={onRefresh}>
      <Card>
        <View style={styles.head}>
          <Avatar name={username} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{username || "-"}</Text>
            <View style={styles.role}>
              <Icon android="shield_person" ios="person.badge.shield.checkmark" size={16} color={colors.brand} />
              <Text style={styles.roleText}>{APP_ROLE_LABEL.spv}</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <CardTitle icon={{ android: "warehouse", ios: "building.2" }} label={`Cabang yang dipegang (${branches.length})`} />
        {loading ? (
          <LoadingCard label="Memuat cabang…" />
        ) : error ? (
          <Text style={kit.muted}>{error}</Text>
        ) : branches.length === 0 ? (
          <Text style={kit.muted}>Belum ada cabang. Hubungi admin.</Text>
        ) : (
          branches.map((b) => (
            <View key={b.id} style={styles.branch}>
              <Text style={kit.strong}>
                {b.code} - {b.name}
              </Text>
              <Text style={kit.muted}>
                {b.latitude !== null ? `Area absen radius ${b.geofence_radius_m} m` : "Titik GPS belum diatur admin"}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Notice
        tone="muted"
        icon={{ android: "info", ios: "info.circle" }}
        title="Absen SPV"
        message="Absen lewat tab Absen: pilih outlet dari cabang Anda, lalu GPS + selfie. Check out boleh di outlet lain. Ceklis & monitoring absensi cabang dilakukan lewat panel web."
      />

      <ThemeSetting />

      <ActionButton
        label="Keluar Akun"
        variant="danger"
        icon={{ android: "logout", ios: "rectangle.portrait.and.arrow.right" }}
        onPress={async () => {
          setSigningOut(true);
          await signOut();
        }}
        loading={signingOut}
      />
      <Text style={[kit.muted, { textAlign: "center" }]}>Absensi Ekspedisi v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  head: { flexDirection: "row", gap: 14, alignItems: "center" },
  name: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: c.cardHigh,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 13 },
  branch: { backgroundColor: c.input, borderRadius: 10, padding: 12, gap: 2 },
}));

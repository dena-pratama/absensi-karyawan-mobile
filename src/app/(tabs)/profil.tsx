import Constants from "expo-constants";
import { useState } from "react";
import { Text, View } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { ThemeSetting } from "@/components/ThemeSetting";
import { ActionButton, Avatar, Card, CardTitle, kit, LoadingCard, Notice, TabScreen } from "@/components/kit";
import { useAuth } from "@/lib/auth";
import { formatRange } from "@/lib/backup";
import { useEmployee, type EmployeeProfile } from "@/lib/employee";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong } from "@/shared/format";
import { displayLogin } from "@/shared/login-id";

const CONTRACT_LABEL: Record<EmployeeProfile["contract_type"], string> = {
  tetap: "Karyawan Tetap",
  pkwt: "Kontrak (PKWT)",
  mitra: "Mitra",
};

function InfoRow({ icon, label, value }: { icon: { android: IconName; ios: string }; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon {...icon} size={20} color={c.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={kit.label}>{label}</Text>
        <Text style={kit.strong}>{value}</Text>
      </View>
    </View>
  );
}

export default function Profil() {
  const { session, signOut } = useAuth();
  const { profile, loading, error, refresh } = useEmployee();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
  }

  const branch = profile?.branch;

  return (
    <TabScreen title="Profil" refreshing={refreshing} onRefresh={onRefresh}>
      {profile ? (
        <>
          <Card>
            <View style={styles.head}>
              <Avatar name={profile.full_name} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{profile.full_name}</Text>
                <Text style={kit.muted}>
                  {profile.jobRole ?? "Jabatan belum diatur"}
                  {branch ? ` • ${branch.code}` : ""}
                </Text>
                <View style={styles.nik}>
                  <Icon android="badge" ios="person.text.rectangle" size={16} color={colors.brand} />
                  <Text style={styles.nikText}>{profile.nik}</Text>
                </View>
              </View>
            </View>
          </Card>

          <Card>
            <CardTitle icon={{ android: "info", ios: "info.circle" }} label="Data Karyawan" />
            <InfoRow
              icon={{ android: "person", ios: "person" }}
              label="Username login"
              value={session?.user.email ? displayLogin(session.user.email) : "-"}
            />
            <InfoRow
              icon={{ android: "warehouse", ios: "building.2" }}
              label="Cabang penempatan"
              value={branch ? `${branch.code} - ${branch.name}` : "Belum ditempatkan"}
            />
            <InfoRow icon={{ android: "work", ios: "briefcase" }} label="Jabatan" value={profile.jobRole ?? "-"} />
            <InfoRow icon={{ android: "contract", ios: "doc.text" }} label="Status kerja" value={CONTRACT_LABEL[profile.contract_type]} />
            {profile.join_date && (
              <InfoRow icon={{ android: "calendar_month", ios: "calendar" }} label="Tanggal bergabung" value={formatDateLong(profile.join_date)} />
            )}
            {branch && (
              <InfoRow
                icon={{ android: "my_location", ios: "location.circle" }}
                label="Area absen cabang"
                value={branch.latitude !== null ? `Radius ${branch.geofence_radius_m} m dari titik cabang` : "Titik GPS belum diatur admin"}
              />
            )}
          </Card>

          {profile.backups.length > 0 && (
            <Card>
              <CardTitle icon={{ android: "swap_horiz", ios: "arrow.left.arrow.right" }} label="Jadwal Backup" />
              {profile.backups.map((b) => (
                <InfoRow
                  key={b.id}
                  icon={{ android: "event", ios: "calendar" }}
                  label={`${formatRange(b.dateFrom, b.dateTo)}${b.id === profile.backupToday?.id ? " • hari ini" : ""}`}
                  value={`${b.toBranch.code} - ${b.toBranch.name}${b.note ? ` (${b.note})` : ""}`}
                />
              ))}
            </Card>
          )}

          <Notice
            tone="muted"
            icon={{ android: "support_agent", ios: "questionmark.circle" }}
            title="Ada data yang salah?"
            message="Perubahan data karyawan, cabang, atau kata sandi dilakukan oleh admin / SPV cabang."
          />
        </>
      ) : loading ? (
        <LoadingCard />
      ) : (
        <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Data belum bisa dimuat" message={error ?? undefined}>
          <View style={{ marginTop: 8 }}>
            <ActionButton label="Coba lagi" variant="secondary" onPress={onRefresh} />
          </View>
        </Notice>
      )}

      <ThemeSetting />

      <ActionButton label="Keluar Akun" variant="danger" icon={{ android: "logout", ios: "rectangle.portrait.and.arrow.right" }} onPress={onSignOut} loading={signingOut} />
      <Text style={[kit.muted, { textAlign: "center" }]}>Absensi Ekspedisi v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  head: { flexDirection: "row", gap: 14, alignItems: "center" },
  name: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  nik: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: c.cardHigh,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  nikText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.5 },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.input, alignItems: "center", justifyContent: "center" },
}));

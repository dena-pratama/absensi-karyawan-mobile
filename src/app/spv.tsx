import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button, Panel, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { formatDateLong, todayWIB } from "@/shared/format";
import { APP_ROLE_LABEL } from "@/shared/labels";

type Profile = { name: string; detail: string | null };

type AppUserRow = {
  employee: { full_name: string; nik: string } | null;
  branch: { name: string; code: string } | null;
};

/** Layar sementara untuk SPV — fitur SPV (pantau absen cabang) belum dibuat. Absen GPS + selfie khusus akun karyawan. */
export default function Spv() {
  const { session, role, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const userId = session?.user.id;
  const email = session?.user.email ?? "";

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from("app_user")
      .select("employee:employee_id(full_name, nik), branch:branch_id(name, code)")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const row = data as AppUserRow | null;
        if (row?.employee) {
          setProfile({ name: row.employee.full_name, detail: `NIK ${row.employee.nik}` });
        } else if (row?.branch) {
          setProfile({ name: email, detail: `Cabang ${row.branch.name} (${row.branch.code})` });
        } else {
          setProfile({ name: email, detail: null });
        }
      });
    return () => {
      active = false;
    };
  }, [userId, email]);

  return (
    <Screen>
      <Text style={styles.date}>{formatDateLong(todayWIB())}</Text>
      <Panel>
        <Text style={styles.label}>Masuk sebagai</Text>
        <Text style={styles.name}>{profile?.name ?? "Memuat…"}</Text>
        {profile?.detail && <Text style={styles.detail}>{profile.detail}</Text>}
        {role && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{APP_ROLE_LABEL[role]}</Text>
          </View>
        )}
      </Panel>
      <Text style={styles.note}>Absen GPS + selfie khusus akun karyawan. Fitur pantau absen cabang untuk SPV sedang disiapkan.</Text>
      <View style={{ marginTop: 20 }}>
        <Button label="Keluar" variant="outline" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { color: colors.brand, fontSize: 14, marginBottom: 12, textAlign: "center" },
  label: { color: colors.muted, fontSize: 13 },
  name: { color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 4 },
  detail: { color: colors.muted, fontSize: 14, marginTop: 4 },
  badge: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  badgeText: { color: colors.brand, fontSize: 12, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 16 },
});

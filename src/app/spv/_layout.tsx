import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { EmployeeProvider } from "@/lib/employee";
import { SpvProvider } from "@/lib/spv";
import { appColors as c, colors, fonts } from "@/lib/theme";

function tabIcon(android: IconName, ios: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon android={android} ios={ios} size={24} color={color} />;
  };
}

/**
 * Tab SPV & Office (Office = SPV yang boleh absen di cabang mana pun): Absen (pilih outlet), Riwayat absen SPV, Kasbon, Backup Karyawan, Profil.
 * Absen & Riwayat memakai data karyawan yang dihubungkan admin ke akun SPV.
 * Ceklis / monitoring absensi cabang hanya lewat panel web (keputusan user).
 */
export default function SpvLayout() {
  return (
    <SpvProvider>
      <EmployeeProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: c.surface },
            tabBarActiveTintColor: colors.brand,
            tabBarInactiveTintColor: c.outline,
            tabBarStyle: { backgroundColor: c.input, borderTopColor: c.cardHigh },
            tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Absen", tabBarIcon: tabIcon("fingerprint", "touchid") }} />
          <Tabs.Screen name="riwayat" options={{ title: "Riwayat", tabBarIcon: tabIcon("receipt_long", "list.bullet.rectangle") }} />
          <Tabs.Screen name="kasbon" options={{ title: "Kasbon", tabBarIcon: tabIcon("account_balance_wallet", "creditcard") }} />
          <Tabs.Screen name="backup" options={{ title: "Backup", tabBarIcon: tabIcon("swap_horiz", "arrow.left.arrow.right") }} />
          <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: tabIcon("badge", "person.text.rectangle") }} />
        </Tabs>
      </EmployeeProvider>
    </SpvProvider>
  );
}

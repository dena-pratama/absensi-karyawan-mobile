import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { SpvProvider } from "@/lib/spv";
import { appColors as c, colors, fonts } from "@/lib/theme";

function tabIcon(android: IconName, ios: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon android={android} ios={ios} size={24} color={color} />;
  };
}

/** Tab SPV: Ceklis (monitoring absensi cabang), Backup Karyawan, Profil. SPV tidak absen sendiri. */
export default function SpvLayout() {
  return (
    <SpvProvider>
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
        <Tabs.Screen name="index" options={{ title: "Ceklis", tabBarIcon: tabIcon("fact_check", "checklist") }} />
        <Tabs.Screen name="backup" options={{ title: "Backup", tabBarIcon: tabIcon("swap_horiz", "arrow.left.arrow.right") }} />
        <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: tabIcon("badge", "person.text.rectangle") }} />
      </Tabs>
    </SpvProvider>
  );
}

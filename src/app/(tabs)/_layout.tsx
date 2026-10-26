import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { Icon, type IconName } from "@/components/Icon";
import { EmployeeProvider } from "@/lib/employee";
import { appColors as c, colors, fonts } from "@/lib/theme";

function tabIcon(android: IconName, ios: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon android={android} ios={ios} size={24} color={color} />;
  };
}

/** Tab utama karyawan: Check In, Check Out, Riwayat, Kasbon, Libur, Profil. */
export default function TabsLayout() {
  return (
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
        <Tabs.Screen name="index" options={{ title: "Check In", tabBarIcon: tabIcon("login", "arrow.right.square") }} />
        <Tabs.Screen name="check-out" options={{ title: "Check Out", tabBarIcon: tabIcon("logout", "rectangle.portrait.and.arrow.right") }} />
        <Tabs.Screen name="riwayat" options={{ title: "Riwayat", tabBarIcon: tabIcon("receipt_long", "list.bullet.rectangle") }} />
        <Tabs.Screen name="kasbon" options={{ title: "Kasbon", tabBarIcon: tabIcon("account_balance_wallet", "creditcard") }} />
        <Tabs.Screen name="libur" options={{ title: "Libur", tabBarIcon: tabIcon("beach_access", "beach.umbrella") }} />
        <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: tabIcon("badge", "person.text.rectangle") }} />
      </Tabs>
    </EmployeeProvider>
  );
}

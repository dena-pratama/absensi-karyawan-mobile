import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { MessageScreen } from "@/components/ui";
import { AuthProvider, useAuth } from "@/lib/auth";
import { configError } from "@/lib/supabase";
import { colors } from "@/lib/theme";

// Splash tetap tampil sampai sesi login tersimpan selesai dibaca.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  if (configError) {
    SplashScreen.hide();
    return (
      <>
        <StatusBar style="light" />
        <MessageScreen
          title="Konfigurasi belum lengkap"
          message={`${configError}\n\nSalin .env.example menjadi .env.local, isi URL & publishable key Supabase, lalu jalankan ulang "npx expo start".`}
        />
      </>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}

/** Mengarahkan layar sesuai status login & role. */
function RootNavigator() {
  const { initializing, session, role } = useAuth();

  useEffect(() => {
    if (!initializing) SplashScreen.hide();
  }, [initializing]);

  if (initializing) return null;

  const signedIn = session !== null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={signedIn && (role === "karyawan" || role === "spv")}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === "admin"}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === null}>
        <Stack.Screen name="tanpa-akses" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

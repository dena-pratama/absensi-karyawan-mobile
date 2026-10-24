import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { MessageScreen } from "@/components/ui";
import { AuthProvider, useAuth } from "@/lib/auth";
import { configError } from "@/lib/supabase";
import { colors, ThemeProvider, useTheme } from "@/lib/theme";
import { attendsSelf } from "@/shared/labels";

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

  // Tema di dalam AuthProvider: saat tema diganti, hanya tampilan yang dimuat ulang (sesi login tetap).
  return (
    <AuthProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}

/** Mengarahkan layar sesuai status login & role. */
function RootNavigator() {
  const { initializing, session, role } = useAuth();
  const { scheme, ready: themeReady } = useTheme();
  // Kalau font gagal dimuat (fontError), app tetap jalan dengan font bawaan HP.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = !initializing && themeReady && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const signedIn = session !== null;
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn && role === "karyawan"}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        {/* Office = SPV yang boleh absen di cabang mana pun → memakai layar SPV yang sama. */}
        <Stack.Protected guard={signedIn && attendsSelf(role)}>
          <Stack.Screen name="spv" />
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
    </>
  );
}

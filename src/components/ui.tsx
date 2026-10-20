// Komponen tampilan dasar yang dipakai banyak layar.

import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/lib/theme";

/** Layar penuh dengan latar gelap, konten di tengah. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>{children}</View>
    </SafeAreaView>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = "primary", loading, disabled }: ButtonProps) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonOutline,
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.bg : colors.brand} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.bg : colors.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Layar pesan sederhana: judul, keterangan, dan tombol aksi. */
export function MessageScreen({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <Screen>
      <Panel>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>{children}</View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", padding: 20 },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  button: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonOutline: { borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 15, fontWeight: "700" },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  message: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  actions: { marginTop: 20, gap: 10 },
});

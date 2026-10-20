import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { Button, Panel, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

/** Login email + kata sandi. Akun dibuat admin di panel web, jadi tidak ada daftar / lupa sandi. */
export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Isi email dan kata sandi terlebih dahulu.");
      return;
    }
    setError(null);
    setBusy(true);
    const message = await signIn(email, password);
    // Kalau berhasil, layar ini otomatis diganti; busy dibiarkan agar tombol tidak bisa ditekan lagi.
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={styles.header}>
          <Text style={styles.brand}>Absensi Ekspedisi</Text>
          <Text style={styles.subtitle}>Masuk dengan akun dari admin</Text>
        </View>
        <Panel>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="nama@contoh.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            editable={!busy}
          />
          <Text style={[styles.label, { marginTop: 14 }]}>Kata sandi</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={{ marginTop: 20 }}>
            <Button label="Masuk" onPress={submit} loading={busy} />
          </View>
        </Panel>
        <Text style={styles.hint}>Belum punya akun atau lupa kata sandi? Hubungi admin / SPV cabang.</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: "center", marginBottom: 24 },
  brand: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.brand, fontSize: 14, marginTop: 6 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 10,
    marginTop: 14,
    fontSize: 13,
  },
  hint: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 20 },
});

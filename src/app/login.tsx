import Constants from "expo-constants";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth";
import { colors, fonts, loginColors as c } from "@/lib/theme";

type IconName = NonNullable<Exclude<SymbolViewProps["name"], string>["android"]>;

/** Ikon Material Symbols (Android/web) dengan padanan SF Symbols di iOS. */
function Icon({ android, ios, size = 20, color }: { android: IconName; ios: string; size?: number; color: string }) {
  return (
    <SymbolView
      name={{ android, ios: ios as never, web: android }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

type FieldProps = TextInputProps & {
  label: string;
  icon: { android: IconName; ios: string };
  right?: React.ReactNode;
  ref?: React.Ref<TextInputInstance>;
};

function Field({ label, icon, right, style, ref, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <Icon {...icon} color={c.outline} />
        <TextInput
          {...input}
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={c.outlineVariant}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </View>
    </View>
  );
}

/** Login email + kata sandi. Akun dibuat admin di panel web, jadi tidak ada daftar / lupa sandi. */
export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

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
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Icon android="sensors" ios="sensor" size={16} color={c.tint} />
            <Text style={styles.version}>v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
          </View>

          <View style={styles.brand}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <Icon android="local_shipping" ios="truck.box.fill" size={28} color={colors.brand} />
              </View>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.title}>Absensi Ekspedisi</Text>
            <Text style={styles.subtitle}>Portal Presensi Operasional Kurir & Driver</Text>
          </View>

          <View style={styles.card}>
            <Field
              label="Email"
              icon={{ android: "mail", ios: "envelope" }}
              value={email}
              onChangeText={setEmail}
              placeholder="nama@contoh.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              editable={!busy}
            />
            <Field
              ref={passwordRef}
              label="Kata Sandi"
              icon={{ android: "lock", ios: "lock" }}
              value={password}
              onChangeText={setPassword}
              placeholder="Masukkan kata sandi"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
              right={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  <Icon
                    android={showPassword ? "visibility_off" : "visibility"}
                    ios={showPassword ? "eye.slash" : "eye"}
                    color={c.outline}
                  />
                </Pressable>
              }
            />

            {error && (
              <View style={styles.error}>
                <Icon android="error" ios="exclamationmark.circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
            >
              {busy ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <>
                  <Text style={styles.buttonText}>Login</Text>
                  <Icon android="arrow_forward" ios="arrow.right" color={c.onPrimary} />
                </>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>Belum punya akun atau lupa kata sandi? Hubungi admin / SPV cabang.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  version: { color: c.onSurfaceVariant, fontFamily: fonts.medium, fontSize: 11 },

  brand: { alignItems: "center" },
  logoOuter: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: c.cardHigh,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    boxShadow: "0 12px 24px rgba(6, 14, 28, 0.8)",
  },
  logoInner: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: c.card,
    alignItems: "center",
    justifyContent: "center",
  },
  logoDot: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.brand,
    boxShadow: `0 0 10px ${colors.brand}`,
  },
  title: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  subtitle: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, marginTop: 2 },

  card: {
    backgroundColor: c.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    boxShadow: "0 25px 50px rgba(11, 12, 16, 0.9)",
  },
  field: { gap: 6 },
  label: { color: c.onSurfaceVariant, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.input,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 12,
    height: 46,
  },
  inputBoxFocused: { borderColor: colors.brand },
  input: {
    flex: 1,
    height: "100%",
    color: c.onSurface,
    fontFamily: fonts.medium,
    fontSize: 14,
    padding: 0,
  },

  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 10,
  },
  errorText: { flex: 1, color: colors.danger, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },

  button: {
    marginTop: 4,
    height: 46,
    borderRadius: 8,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    boxShadow: "0 0 18px rgba(0, 210, 255, 0.35)",
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  buttonText: { color: c.onPrimary, fontFamily: fonts.semibold, fontSize: 14 },

  hint: {
    color: c.onSurfaceVariant,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
});

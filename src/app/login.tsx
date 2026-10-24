import Constants from "expo-constants";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { PASSWORD_MIN, toLoginEmail } from "@/shared/login-id";

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

/** Login username (atau email untuk admin) + kata sandi. Akun dibuat admin di panel web, jadi tidak ada daftar / lupa sandi. */
export default function Login() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!identifier.trim() || !password) {
      setError("Isi username / email dan kata sandi terlebih dahulu.");
      return;
    }
    // Username "budi01" → email internal Supabase; format tidak valid / sandi terlalu pendek pasti salah.
    const loginEmail = toLoginEmail(identifier);
    if (!loginEmail || password.length < PASSWORD_MIN) {
      setError("Username / email atau kata sandi salah.");
      return;
    }
    setError(null);
    setBusy(true);
    const message = await signIn(loginEmail, password);
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
          <View style={styles.brand}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                {/* Simbol logo app (gambar yang sama dengan splash / ikon app). */}
                <Image
                  source={require("@/assets/images/splash-icon.png")}
                  style={styles.logoGlyph}
                  contentFit="contain"
                  accessibilityLabel="Logo Absensi Ekspedisi"
                />
              </View>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.title}>Absensi Ekspedisi</Text>
            <Text style={styles.subtitle}>Portal Presensi Operasional Kurir & Driver</Text>
          </View>

          <View style={styles.card}>
            <Field
              label="Username / Email"
              icon={{ android: "person", ios: "person" }}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="mis. budi01"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
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

          <View style={styles.versionRow}>
            <Icon android="sensors" ios="sensor" size={16} color={c.tint} />
            <Text style={styles.version}>v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24, gap: 16 },
  versionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },
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
    boxShadow: `0 12px 24px ${c.shadow}`,
  },
  logoInner: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: c.card,
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlyph: { width: 28, height: 28 },
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
    boxShadow: `0 25px 50px ${c.shadow}`,
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
    boxShadow: `0 0 18px ${c.glow}`,
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
}));

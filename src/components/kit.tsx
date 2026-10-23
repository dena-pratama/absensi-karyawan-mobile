// Komponen tampilan untuk layar tab (gaya desain Stitch: kartu, aksen cyan; ikut tema terang/gelap).

import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong, todayWIB } from "@/shared/format";
import { Icon, type IconName } from "./Icon";

/** Kerangka layar tab: judul kecil + judul besar, isi bisa digulir & ditarik untuk memuat ulang. */
export function TabScreen({
  title,
  right,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
              progressBackgroundColor={c.card}
            />
          ) : undefined
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.caption}>ABSENSI EKSPEDISI</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ icon, label, right }: { icon: { android: IconName; ios: string }; label: string; right?: ReactNode }) {
  return (
    <View style={styles.cardTitleRow}>
      <View style={styles.cardTitle}>
        <Icon {...icon} size={20} color={c.tint} />
        <Text style={styles.cardTitleText}>{label}</Text>
      </View>
      {right}
    </View>
  );
}

export type Tone = "success" | "warning" | "danger" | "info" | "muted";

/** Warna per nada (dibaca saat render supaya ikut tema aktif). */
function tone(t: Tone): { fg: string; bg: string } {
  switch (t) {
    case "success":
      return { fg: c.success, bg: c.successBg };
    case "warning":
      return { fg: c.warning, bg: c.warningBg };
    case "danger":
      return { fg: c.absent, bg: c.absentBg };
    case "info":
      return { fg: colors.brand, bg: c.infoBg };
    case "muted":
      return { fg: c.onSurfaceVariant, bg: c.cardHigh };
  }
}

/** Label status kecil dengan titik warna. */
export function Pill({ tone: toneName, label }: { tone: Tone; label: string }) {
  const t = tone(toneName);
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.pillText, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Kotak pesan berwarna (berhasil / peringatan / gagal). */
export function Notice({
  tone: toneName,
  icon,
  title,
  message,
  children,
}: {
  tone: Tone;
  icon: { android: IconName; ios: string };
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  const t = tone(toneName);
  return (
    <View style={[styles.notice, { backgroundColor: t.bg }]}>
      <Icon {...icon} size={22} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.noticeTitle, { color: t.fg }]}>{title}</Text>
        {message ? <Text style={styles.noticeText}>{message}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/** Foto profil pengganti: inisial nama dalam kotak. */
export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials || "?"}</Text>
    </View>
  );
}

/** Jam berjalan (WIB) — komponen terpisah supaya hanya bagian ini yang diperbarui tiap detik. */
export function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(now)
    .replace(/\./g, ":");
  return (
    <View style={styles.clock}>
      <Text style={styles.clockTime}>{time} WIB</Text>
      <Text style={styles.clockDate}>{formatDateLong(todayWIB())}</Text>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  icon?: { android: IconName; ios: string };
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

export function ActionButton({ label, icon, onPress, disabled, loading, variant = "primary" }: ActionButtonProps) {
  const fg = variant === "primary" ? c.onPrimary : variant === "danger" ? c.absent : c.onSurface;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon {...icon} size={22} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Tombol kecil bergaya chip (mis. "Perbarui", "Ulangi"). */
export function ChipButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: { android: IconName; ios: string };
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Icon {...icon} size={16} color={c.onSurface} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export function LoadingCard({ label = "Memuat data…" }: { label?: string }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 32, gap: 10 }}>
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.muted}>{label}</Text>
    </Card>
  );
}

export const kit = themedStyles(() => ({
  label: { color: c.onSurfaceVariant, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  body: { color: c.onSurface, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  muted: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  strong: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  mono: { color: c.onSurfaceVariant, fontFamily: fonts.medium, fontSize: 11, fontVariant: ["tabular-nums"] },
}));

const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: c.surface },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  caption: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.5 },
  title: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },

  card: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: c.cardBorder,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  cardTitleText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 15 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fonts.semibold, fontSize: 11 },

  notice: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 10, alignItems: "flex-start" },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  noticeText: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },

  avatar: { backgroundColor: c.cardHigh, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brand, fontFamily: fonts.bold },

  clock: { backgroundColor: c.input, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  clockTime: { color: c.primary, fontFamily: fonts.bold, fontSize: 22, fontVariant: ["tabular-nums"], letterSpacing: 1 },
  clockDate: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },

  button: {
    minHeight: 54,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  buttonPrimary: { backgroundColor: colors.brand, boxShadow: `0 0 18px ${c.glow}` },
  buttonSecondary: { backgroundColor: c.cardHigh },
  buttonDanger: { backgroundColor: c.absentBg, borderWidth: 1, borderColor: "rgba(244, 63, 94, 0.3)" },
  buttonDisabled: { opacity: 0.4, boxShadow: "none" },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.cardHigh,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: c.onSurface, fontFamily: fonts.medium, fontSize: 12 },
  muted: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12 },
}));

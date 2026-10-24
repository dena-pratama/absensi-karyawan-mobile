import { Modal, Pressable, Text, View } from "react-native";

import type { CheckKind } from "@/lib/attendance";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong, formatTimeWIB, todayWIB } from "@/shared/format";
import { Icon } from "../Icon";

export type CheckSuccess = {
  kind: CheckKind;
  /** Jam tercatat dari server (ISO). */
  at: string;
  /** "JKT109A - Hub Cengkareng" atau null bila tidak diketahui. */
  outlet: string | null;
};

/** Pop up setelah check in / check out berhasil: jam tercatat & outlet. */
export function SuccessDialog({ success, onClose }: { success: CheckSuccess | null; onClose: () => void }) {
  const isIn = success?.kind === "in";
  return (
    <Modal visible={success !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Tutup">
        {success && (
          <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
            <View style={styles.iconWrap}>
              <Icon android="check_circle" ios="checkmark.circle.fill" size={56} color={c.success} />
            </View>
            <Text style={styles.title}>{isIn ? "Check In Berhasil" : "Check Out Berhasil"}</Text>
            <Text style={styles.label}>Tercatat pukul</Text>
            <Text style={styles.time}>{formatTimeWIB(success.at)}</Text>
            <Text style={styles.detail}>
              {formatDateLong(todayWIB())}
              {success.outlet ? `\ndi ${success.outlet}` : ""}
            </Text>
            <Text style={styles.hint}>
              {isIn ? "Jangan lupa check out saat pulang." : "Terima kasih, selamat beristirahat."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.buttonText}>OK</Text>
            </Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: c.cardBorder,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: c.successBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 20, marginBottom: 8 },
  label: { color: c.onSurfaceVariant, fontFamily: fonts.medium, fontSize: 12 },
  time: { color: colors.brand, fontFamily: fonts.bold, fontSize: 32, fontVariant: ["tabular-nums"] },
  detail: { color: c.onSurface, fontFamily: fonts.medium, fontSize: 13, textAlign: "center", lineHeight: 19 },
  hint: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12, textAlign: "center", marginTop: 8 },
  button: {
    marginTop: 16,
    alignSelf: "stretch",
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: c.onPrimary, fontFamily: fonts.semibold, fontSize: 15 },
}));

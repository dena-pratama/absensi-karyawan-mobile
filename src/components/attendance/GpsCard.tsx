import { StyleSheet, Text, View } from "react-native";

import type { BranchInfo } from "@/lib/employee";
import { distanceM, type GpsState } from "@/lib/location";
import { appColors as c } from "@/lib/theme";
import { Icon } from "../Icon";
import { Card, CardTitle, ChipButton, kit, Notice, Pill, type Tone } from "../kit";

export type GpsCheck = {
  /** true = boleh absen (dalam radius cabang, bukan lokasi palsu). */
  ok: boolean;
  tone: Tone;
  title: string;
  message?: string;
};

/** Nilai status GPS terhadap area cabang. Server mengecek ulang dengan rumus yang sama. */
export function evaluateGps(branch: BranchInfo | null, gps: GpsState): GpsCheck {
  if (!branch) return { ok: false, tone: "warning", title: "Belum ada penempatan cabang", message: "Hubungi admin." };
  if (branch.latitude === null || branch.longitude === null) {
    return { ok: false, tone: "warning", title: "Titik GPS cabang belum diatur", message: "Minta admin mengatur Area GPS Absen cabang di panel web." };
  }
  switch (gps.status) {
    case "locating":
      return { ok: false, tone: "info", title: "Mencari lokasi Anda…", message: "Pastikan GPS aktif. Di tempat terbuka biasanya lebih cepat." };
    case "denied":
      return {
        ok: false,
        tone: "danger",
        title: "Izin lokasi ditolak",
        message: gps.canAskAgain
          ? "Tekan Perbarui lalu pilih Izinkan."
          : "Buka Pengaturan HP → Aplikasi → izinkan Lokasi untuk app ini.",
      };
    case "off":
      return { ok: false, tone: "danger", title: "GPS HP mati", message: "Nyalakan Lokasi/GPS di HP lalu tekan Perbarui." };
    case "error":
      return { ok: false, tone: "danger", title: "Lokasi belum didapat", message: gps.message };
  }
  if (gps.fix.mocked) {
    return { ok: false, tone: "danger", title: "Lokasi palsu terdeteksi", message: "Matikan aplikasi fake GPS / lokasi tiruan lalu coba lagi." };
  }
  const d = Math.round(distanceM(gps.fix, { lat: branch.latitude, lng: branch.longitude }));
  if (d > branch.geofence_radius_m) {
    return {
      ok: false,
      tone: "danger",
      title: "Di luar area cabang",
      message: `Jarak ${d} m dari titik cabang (batas ${branch.geofence_radius_m} m). Mendekatlah lalu tekan Perbarui.`,
    };
  }
  return {
    ok: true,
    tone: "success",
    title: "Dalam area cabang",
    message: `Jarak ${d} m dari titik cabang (batas ${branch.geofence_radius_m} m).`,
  };
}

export function GpsCard({
  branch,
  gps,
  check,
  onRefresh,
}: {
  branch: BranchInfo | null;
  gps: GpsState;
  check: GpsCheck;
  onRefresh: () => void;
}) {
  const accuracy = gps.status === "ok" && gps.fix.accuracy !== null ? `±${Math.round(gps.fix.accuracy)} m` : null;
  return (
    <Card>
      <CardTitle
        icon={{ android: "my_location", ios: "location.circle" }}
        label="Lokasi GPS"
        right={accuracy ? <Pill tone="muted" label={`Akurasi ${accuracy}`} /> : null}
      />

      {branch && (
        <View style={styles.branch}>
          <Icon android="warehouse" ios="building.2" size={20} color={c.tint} />
          <View style={{ flex: 1 }}>
            <Text style={kit.strong} numberOfLines={1}>
              {branch.code} - {branch.name}
            </Text>
            {gps.status === "ok" && (
              <Text style={kit.mono}>
                Posisi Anda: {gps.fix.lat.toFixed(5)}, {gps.fix.lng.toFixed(5)}
              </Text>
            )}
          </View>
        </View>
      )}

      <Notice
        tone={check.tone}
        icon={
          check.ok
            ? { android: "verified", ios: "checkmark.seal.fill" }
            : gps.status === "locating"
              ? { android: "satellite_alt", ios: "antenna.radiowaves.left.and.right" }
              : { android: "location_off", ios: "location.slash" }
        }
        title={check.title}
        message={check.message}
      />

      <View style={styles.actions}>
        <ChipButton
          label={gps.status === "locating" ? "Mencari…" : "Perbarui Lokasi"}
          icon={{ android: "refresh", ios: "arrow.clockwise" }}
          onPress={onRefresh}
          disabled={gps.status === "locating"}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  branch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.input,
    borderRadius: 10,
    padding: 12,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
});

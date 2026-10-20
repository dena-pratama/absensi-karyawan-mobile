// Layar Check In / Check Out: sapaan + jam, cek lokasi GPS, foto selfie, lalu kirim.

import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { submitAttendance, type CheckKind } from "@/lib/attendance";
import { useEmployee, type EmployeeProfile } from "@/lib/employee";
import { locate, type GpsState } from "@/lib/location";
import { appColors as c, colors, fonts } from "@/lib/theme";
import { formatTimeWIB } from "@/shared/format";
import { ATTENDANCE_LABEL } from "@/shared/labels";
import { Icon } from "../Icon";
import { ActionButton, Avatar, Card, kit, LiveClock, LoadingCard, Notice, Pill, TabScreen, type Tone } from "../kit";
import { evaluateGps, GpsCard } from "./GpsCard";
import { SelfieCard } from "./SelfieCard";

const TEXT: Record<CheckKind, { title: string; submit: string; done: string }> = {
  in: { title: "Check In", submit: "Kirim Absen Masuk (Check-In)", done: "Absen masuk tercatat" },
  out: { title: "Check Out", submit: "Kirim Absen Pulang (Check-Out)", done: "Absen pulang tercatat" },
};

function GreetingCard({ profile, status }: { profile: EmployeeProfile; status: { tone: Tone; label: string } }) {
  return (
    <Card>
      <View style={styles.greetRow}>
        <Avatar name={profile.full_name} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.greetCaption} numberOfLines={1}>
            KARYAWAN • {profile.nik}
          </Text>
          <Text style={styles.greetName} numberOfLines={1}>
            Halo, {profile.full_name}
          </Text>
          <Text style={kit.muted} numberOfLines={2}>
            {profile.branch ? `${profile.branch.code} - ${profile.branch.name}` : "Belum ada penempatan"}
            {profile.jobRole ? ` • ${profile.jobRole}` : ""}
          </Text>
        </View>
      </View>
      <View style={{ alignSelf: "flex-start" }}>
        <Pill tone={status.tone} label={status.label} />
      </View>
      <LiveClock />
    </Card>
  );
}

function GpsHeaderPill({ gps }: { gps: GpsState | null }) {
  const ok = gps?.status === "ok" && !gps.fix.mocked;
  return (
    <View style={styles.gpsPill}>
      <View style={[styles.gpsDot, { backgroundColor: ok ? c.success : gps?.status === "locating" ? c.warning : c.outline }]} />
      <Icon android="satellite_alt" ios="antenna.radiowaves.left.and.right" size={16} color={c.tint} />
      <Text style={styles.gpsPillText}>{ok ? "GPS OK" : gps?.status === "locating" ? "MENCARI" : "GPS"}</Text>
    </View>
  );
}

export function CheckScreen({ kind }: { kind: CheckKind }) {
  const { loading, error, profile, today, refresh } = useEmployee();
  const focused = useIsFocused();
  const [gps, setGps] = useState<GpsState | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Kondisi absen hari ini
  const checkedIn = !!today?.check_in_at;
  const checkedOut = !!today?.check_out_at;
  const markedAbsent = today !== null && today.status !== "hadir";
  const done = kind === "in" ? checkedIn : checkedOut;
  const blocked = markedAbsent || (kind === "out" && !checkedIn);
  const canCapture = !!profile && !done && !blocked;

  const updateLocation = useCallback(async () => {
    setGps({ status: "locating" });
    setGps(await locate());
  }, []);

  // Ambil lokasi setiap kali tab ini dibuka (hanya kalau masih perlu absen).
  useFocusEffect(
    useCallback(() => {
      if (canCapture) updateLocation();
    }, [canCapture, updateLocation]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    if (canCapture) await updateLocation();
    setRefreshing(false);
  }

  if (!profile) {
    return (
      <TabScreen title={TEXT[kind].title} refreshing={refreshing} onRefresh={onRefresh}>
        {loading ? (
          <LoadingCard />
        ) : (
          <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Data belum bisa dimuat" message={error ?? undefined}>
            <View style={{ marginTop: 8 }}>
              <ActionButton label="Coba lagi" variant="secondary" onPress={onRefresh} />
            </View>
          </Notice>
        )}
      </TabScreen>
    );
  }

  const status: { tone: Tone; label: string } = markedAbsent
    ? { tone: "warning", label: ATTENDANCE_LABEL[today!.status] }
    : checkedOut
      ? { tone: "success", label: "Selesai hari ini" }
      : checkedIn
        ? { tone: "info", label: "Sudah masuk • belum pulang" }
        : { tone: "muted", label: "Belum absen" };

  const gpsCheck = evaluateGps(profile.branch, gps ?? { status: "locating" });
  const ready = gpsCheck.ok && !!photoUri && !submitting;
  const missing = !gpsCheck.ok ? "Lokasi belum memenuhi syarat." : !photoUri ? "Ambil foto selfie dulu." : null;

  async function submit() {
    if (!profile || gps?.status !== "ok" || !photoUri) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitAttendance(kind, profile.id, gps.fix, photoUri);
    if (result.ok) {
      setPhotoUri(null);
      await refresh();
    } else {
      setSubmitError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <TabScreen title={TEXT[kind].title} right={canCapture ? <GpsHeaderPill gps={gps} /> : null} refreshing={refreshing} onRefresh={onRefresh}>
      <GreetingCard profile={profile} status={status} />

      {done && today && (
        <Notice
          tone="success"
          icon={{ android: "task_alt", ios: "checkmark.circle.fill" }}
          title={TEXT[kind].done}
          message={`${kind === "in" ? "Masuk" : "Pulang"} pukul ${formatTimeWIB((kind === "in" ? today.check_in_at : today.check_out_at)!)}${
            kind === "in" && !checkedOut ? ". Jangan lupa Check Out saat pulang." : "."
          }`}
        />
      )}

      {!done && markedAbsent && today && (
        <Notice
          tone="warning"
          icon={{ android: "info", ios: "info.circle" }}
          title={`Hari ini tercatat "${ATTENDANCE_LABEL[today.status]}"`}
          message="Status ini diisi SPV/admin. Hubungi SPV kalau tidak sesuai."
        />
      )}

      {!done && !markedAbsent && kind === "out" && !checkedIn && (
        <Notice
          tone="info"
          icon={{ android: "login", ios: "arrow.right.square" }}
          title="Belum absen masuk"
          message="Lakukan Check In dulu di tab Check In."
        />
      )}

      {canCapture && (
        <>
          <GpsCard branch={profile.branch} gps={gps ?? { status: "locating" }} check={gpsCheck} onRefresh={updateLocation} />
          <SelfieCard
            active={focused}
            photoUri={photoUri}
            onCapture={setPhotoUri}
            onReset={() => setPhotoUri(null)}
            disabled={submitting}
          />
          {submitError && (
            <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Absen belum terkirim" message={submitError} />
          )}
          <ActionButton
            label={TEXT[kind].submit}
            icon={{ android: "fingerprint", ios: "touchid" }}
            onPress={submit}
            disabled={!ready}
            loading={submitting}
          />
          <View style={styles.footnote}>
            <Icon android="info" ios="info.circle" size={14} color={c.outline} />
            <Text style={kit.muted}>{missing ?? "Jam absen dicatat dari server dan langsung terlihat oleh SPV cabang."}</Text>
          </View>
        </>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  greetCaption: { color: colors.brand, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.5 },
  greetName: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  gpsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.cardHigh,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsPillText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 11 },
  footnote: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
});

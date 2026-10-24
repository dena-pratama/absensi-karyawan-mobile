// Layar Check In / Check Out (karyawan) dan Absen (SPV, dengan pilihan outlet):
// sapaan + jam, cek lokasi GPS, foto selfie, lalu kirim.

import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { submitAttendance, type AttendanceRow, type CheckKind } from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { formatRange } from "@/lib/backup";
import { NOT_LINKED_KARYAWAN, NOT_LINKED_SPV, useEmployee, type BranchInfo, type EmployeeProfile } from "@/lib/employee";
import { locate, type GpsState } from "@/lib/location";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatTimeWIB } from "@/shared/format";
import { ATTENDANCE_LABEL } from "@/shared/labels";
import { Icon, type IconName } from "../Icon";
import { ActionButton, Avatar, Card, CardTitle, kit, LiveClock, LoadingCard, Notice, Pill, TabScreen, type Tone } from "../kit";
import { evaluateGps, evaluateWfa, GpsCard } from "./GpsCard";
import { OutletPicker, rankOutlets } from "./OutletPicker";
import { SuccessDialog, type CheckSuccess } from "./SuccessDialog";
import { SelfieCard } from "./SelfieCard";

const TEXT: Record<CheckKind, { title: string; submit: string; done: string }> = {
  in: { title: "Check In", submit: "Kirim Absen Masuk (Check-In)", done: "Absen masuk tercatat" },
  out: { title: "Check Out", submit: "Kirim Absen Pulang (Check-Out)", done: "Absen pulang tercatat" },
};

function GreetingCard({
  profile,
  status,
  roleLabel,
}: {
  profile: EmployeeProfile;
  status: { tone: Tone; label: string };
  roleLabel: string;
}) {
  return (
    <Card>
      <View style={styles.greetRow}>
        <Avatar name={profile.full_name} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.greetCaption} numberOfLines={1}>
            {roleLabel.toUpperCase()} • {profile.nik}
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

/** "Masuk pukul 07:45 WIB di JKT109A." (+ outlet pulang bila berbeda). */
function doneMessage(kind: CheckKind, today: AttendanceRow, checkedOut: boolean) {
  const inAt = `Masuk pukul ${formatTimeWIB(today.check_in_at!)}${today.branch ? ` di ${today.branch.code}` : ""}${today.check_in_wfa ? " (WFA)" : ""}`;
  if (kind === "in") return `${inAt}.${checkedOut ? "" : " Jangan lupa check out saat pulang."}`;
  const outBranch = today.check_out_branch ?? today.branch;
  return `${inAt}, pulang pukul ${formatTimeWIB(today.check_out_at!)}${outBranch ? ` di ${outBranch.code}` : ""}${today.check_out_wfa ? " (WFA)" : ""}.`;
}

/** Pilihan mode absen untuk SPV / Office: di outlet (dalam radius) atau WFA (di luar outlet). */
function WfaToggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const options: { wfa: boolean; label: string; icon: { android: IconName; ios: string } }[] = [
    { wfa: false, label: "Di outlet", icon: { android: "storefront", ios: "storefront" } },
    { wfa: true, label: "WFA (di luar outlet)", icon: { android: "home_work", ios: "house" } },
  ];
  return (
    <Card>
      <CardTitle icon={{ android: "work_history", ios: "briefcase" }} label="Mode absen" />
      <View style={styles.modeRow}>
        {options.map((o) => {
          const active = o.wfa === value;
          return (
            <Pressable
              key={o.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              disabled={disabled}
              onPress={() => onChange(o.wfa)}
              style={[styles.modeOption, active && styles.modeOptionActive]}
            >
              <Icon {...o.icon} size={20} color={active ? c.onPrimary : c.onSurfaceVariant} />
              <Text style={[styles.modeText, active && { color: c.onPrimary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value && <Text style={kit.muted}>Absen tercatat di cabang utama, lokasi tetap direkam.</Text>}
    </Card>
  );
}

/** Gabungkan daftar cabang tanpa duplikat (urutan pertama dipertahankan). */
function uniqueBranches(list: (BranchInfo | null | undefined)[]): BranchInfo[] {
  const seen = new Set<string>();
  return list.filter((b): b is BranchInfo => !!b && !seen.has(b.id) && !!seen.add(b.id));
}

/**
 * `kind` kosong = satu layar Absen (masuk dulu, lalu pulang).
 * `outlets` diisi untuk SPV: SPV memilih outlet tempat absen dari cabang-cabangnya, dan boleh
 * check out di outlet lain. Server (attendance_check dengan p_branch) mengecek ulang.
 */
export function CheckScreen({ kind: fixedKind, outlets }: { kind?: CheckKind; outlets?: BranchInfo[] }) {
  const { loading, error, profile, today, refresh } = useEmployee();
  const focused = useIsFocused();
  const [gps, setGps] = useState<GpsState | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pickedOutlet, setPickedOutlet] = useState<string | null>(null);
  const [success, setSuccess] = useState<CheckSuccess | null>(null);
  const [wfa, setWfa] = useState(false);
  const { role } = useAuth();
  const isSpv = outlets !== undefined;
  // Office tidak memilih outlet: outlet terdekat dideteksi otomatis (server mengabaikan p_branch).
  const isOffice = isSpv && role === "office";
  const notLinked = error === NOT_LINKED_SPV || error === NOT_LINKED_KARYAWAN;

  // Kondisi absen hari ini
  const checkedIn = !!today?.check_in_at;
  const checkedOut = !!today?.check_out_at;
  const kind: CheckKind = fixedKind ?? (checkedIn ? "out" : "in");
  const title = fixedKind ? TEXT[kind].title : "Absen";
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
      <TabScreen title={title} refreshing={refreshing} onRefresh={onRefresh}>
        {loading ? (
          <LoadingCard />
        ) : (
          <Notice
            tone={notLinked ? "warning" : "danger"}
            icon={notLinked ? { android: "link_off", ios: "link" } : { android: "error", ios: "exclamationmark.circle" }}
            title={notLinked ? "Belum bisa absen" : "Data belum bisa dimuat"}
            message={error ?? undefined}
          >
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

  // Cabang yang boleh dipakai (sama dengan server):
  //   karyawan: sudah ada baris hari ini → cabang baris itu; belum → cabang backup & penempatan (terdekat);
  //   SPV: masuk → outlet pilihan dari cabangnya (+ penempatan/backup), atau cabang baris yang sudah
  //        diisi ceklis; pulang → outlet mana pun miliknya.
  const autoCandidates = today?.branch
    ? [today.branch]
    : uniqueBranches([profile.backupToday?.toBranch, profile.branch]);
  const outletOptions = !isSpv
    ? []
    : kind === "in" && today?.branch
      ? [today.branch]
      : uniqueBranches([...outlets, profile.branch, profile.backupToday?.toBranch, kind === "out" ? today?.branch : null]);
  const ranked = rankOutlets(outletOptions, gps);
  // Jelaskan kenapa hanya ada satu pilihan outlet.
  const outletNote =
    ranked.length !== 1
      ? undefined
      : kind === "in" && today?.branch
        ? `Hari ini Anda sudah tercatat di ${today.branch.code} (diisi lewat ceklis di web), jadi check in harus di outlet itu.`
        : "Akun ini baru memegang 1 cabang. Minta admin menambah cabang di panel web (Pengguna & Akses) supaya bisa memilih outlet lain.";
  // Pilihan pengguna dipakai selama masih ada di daftar; kalau belum memilih → outlet terdekat.
  const outletId = ranked.some((r) => r.branch.id === pickedOutlet) ? pickedOutlet : (ranked[0]?.branch.id ?? null);
  const candidates = isOffice
    ? outletOptions
    : isSpv
      ? ranked.filter((r) => r.branch.id === outletId).map((r) => r.branch)
      : autoCandidates;
  // WFA: tercatat di cabang utama (penempatan), atau cabang baris hari ini bila sudah ada.
  const wfaBranch = today?.branch ?? profile.branch;
  const useWfa = isSpv && wfa;
  const gpsCheck = useWfa
    ? evaluateWfa(wfaBranch, gps ?? { status: "locating" })
    : evaluateGps(candidates, gps ?? { status: "locating" });
  const backup = profile.backupToday;
  const ready = gpsCheck.ok && !!photoUri && !submitting;
  const missing = !gpsCheck.ok ? "Lokasi belum memenuhi syarat." : !photoUri ? "Ambil foto selfie dulu." : null;

  async function submit() {
    if (!profile || gps?.status !== "ok" || !photoUri) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitAttendance(
      kind,
      profile.id,
      gps.fix,
      photoUri,
      isSpv && !isOffice && !useWfa ? (outletId ?? undefined) : undefined,
      useWfa,
    );
    if (result.ok) {
      // Nama outlet tercatat: dari daftar cabang yang sudah dimuat (kandidat / pilihan outlet / profil).
      const known = uniqueBranches([...candidates, ...outletOptions, wfaBranch, profile.backupToday?.toBranch]);
      const b = known.find((x) => x.id === result.branchId) ?? gpsCheck.branch;
      setSuccess({ kind, at: result.at, outlet: b ? `${b.code} - ${b.name}${useWfa ? " (WFA)" : ""}` : null });
      setPhotoUri(null);
      await refresh();
    } else {
      setSubmitError(result.message);
    }
    setSubmitting(false);
  }

  return (
    <TabScreen title={title} right={canCapture ? <GpsHeaderPill gps={gps} /> : null} refreshing={refreshing} onRefresh={onRefresh}>
      <GreetingCard profile={profile} status={status} roleLabel={role === "office" ? "Office" : isSpv ? "SPV" : "Karyawan"} />

      {backup && (
        <Notice
          tone="info"
          icon={{ android: "swap_horiz", ios: "arrow.left.arrow.right" }}
          title={`Hari ini backup di ${backup.toBranch.code} - ${backup.toBranch.name}`}
          message={`Penugasan ${formatRange(backup.dateFrom, backup.dateTo)}${backup.note ? ` • ${backup.note}` : ""}. Absen di cabang ini; absensi hari ini dihitung di cabang tersebut.`}
        />
      )}

      {done && today && (
        <Notice
          tone="success"
          icon={{ android: "task_alt", ios: "checkmark.circle.fill" }}
          title={TEXT[kind].done}
          message={doneMessage(kind, today, checkedOut)}
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
          {isSpv && <WfaToggle value={wfa} onChange={setWfa} disabled={submitting} />}
          {isOffice && !useWfa && (
            <Notice
              tone="muted"
              icon={{ android: "near_me", ios: "location" }}
              title="Outlet terdekat dideteksi otomatis"
              message="Office tidak perlu memilih outlet. Absen tercatat di outlet terdekat yang radiusnya memuat lokasi Anda."
            />
          )}
          {isSpv && !isOffice && !useWfa && (
            <OutletPicker
              title={kind === "in" ? "Outlet check in" : "Outlet check out"}
              ranked={ranked}
              value={outletId}
              onChange={setPickedOutlet}
              disabled={submitting}
              note={outletNote}
            />
          )}
          <GpsCard gps={gps ?? { status: "locating" }} check={gpsCheck} onRefresh={updateLocation} />
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
      <SuccessDialog success={success} onClose={() => setSuccess(null)} />
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
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
  modeRow: { flexDirection: "row", gap: 8 },
  modeOption: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: c.input,
  },
  modeOptionActive: { backgroundColor: colors.brand },
  modeText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 12, textAlign: "center" },
  footnote: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
}));

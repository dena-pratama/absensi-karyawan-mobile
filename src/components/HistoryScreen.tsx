import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { ActionButton, Card, CardTitle, kit, LoadingCard, Notice, Pill, TabScreen, type Tone } from "@/components/kit";
import { fetchMonth, formatDuration, workedMinutes, type AttendanceRow } from "@/lib/attendance";
import { useEmployee } from "@/lib/employee";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong, formatTimeWIB, todayWIB } from "@/shared/format";
import { ATTENDANCE_LABEL } from "@/shared/labels";

type Month = { year: number; month: number };

function currentMonth(): Month {
  const [y, m] = todayWIB().split("-").map(Number);
  return { year: y, month: m };
}

function monthLabel({ year, month }: Month) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function shiftMonth({ year, month }: Month, delta: number): Month {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function rowStatus(row: AttendanceRow, isToday: boolean): { tone: Tone; label: string } {
  if (row.status === "sakit") return { tone: "warning", label: ATTENDANCE_LABEL.sakit };
  if (row.status === "tidak_hadir") return { tone: "danger", label: ATTENDANCE_LABEL.tidak_hadir };
  if (!row.check_in_at) return { tone: "success", label: "Hadir (dicatat SPV)" };
  if (!row.check_out_at) return isToday ? { tone: "info", label: "Belum pulang" } : { tone: "warning", label: "Tanpa check-out" };
  return { tone: "success", label: "Hadir" };
}

function StatBox({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return (
    <View style={styles.stat}>
      <Text style={kit.label}>{label}</Text>
      <Text style={styles.statValue}>
        <Text style={{ color: tone }}>{value}</Text>
        <Text style={styles.statUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

function DayCard({ row }: { row: AttendanceRow }) {
  const isToday = row.attendance_date === todayWIB();
  const status = rowStatus(row, isToday);
  const minutes = workedMinutes(row);
  // Outlet check out ditampilkan hanya bila berbeda dari outlet check in (SPV boleh pulang di outlet lain).
  const outBranch = row.check_out_branch && row.check_out_branch.id !== row.branch?.id ? row.check_out_branch : null;
  return (
    <Card>
      <View style={styles.dayHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayTitle}>
            {formatDateLong(row.attendance_date)}
            {isToday ? <Text style={styles.today}>  • Hari ini</Text> : null}
          </Text>
          {row.branch && (
            <Text style={kit.muted} numberOfLines={1}>
              {row.branch.code} - {row.branch.name}
            </Text>
          )}
        </View>
        <Pill tone={status.tone} label={status.label} />
      </View>

      {row.status === "hadir" && row.check_in_at ? (
        <View style={styles.times}>
          <View style={styles.timeCol}>
            <View style={styles.timeLabel}>
              <Icon android="login" ios="arrow.right.square" size={16} color={colors.brand} />
              <Text style={kit.label}>MASUK</Text>
              {row.check_in_wfa ? <Pill tone="info" label="WFA" /> : null}
            </View>
            <Text style={styles.time}>{formatTimeWIB(row.check_in_at)}</Text>
            {outBranch && row.branch ? <Text style={kit.muted}>{row.branch.code}</Text> : null}
          </View>
          <View style={styles.timeCol}>
            <View style={styles.timeLabel}>
              <Icon android="logout" ios="rectangle.portrait.and.arrow.right" size={16} color={c.warning} />
              <Text style={kit.label}>PULANG</Text>
              {row.check_out_wfa ? <Pill tone="info" label="WFA" /> : null}
            </View>
            <Text style={styles.time}>{row.check_out_at ? formatTimeWIB(row.check_out_at) : "Belum"}</Text>
            {outBranch ? <Text style={kit.muted}>di {outBranch.code} - {outBranch.name}</Text> : null}
            {minutes !== null && <Text style={kit.muted}>{formatDuration(minutes)}</Text>}
          </View>
        </View>
      ) : null}

      {row.note ? <Text style={kit.muted}>Catatan: {row.note}</Text> : null}
    </Card>
  );
}

/** Riwayat absensi bulanan milik akun yang login (karyawan, atau SPV yang ikut absen). */
export function HistoryScreen() {
  const { profile, today, error: profileError, refresh: refreshProfile } = useEmployee();
  const [month, setMonth] = useState<Month>(currentMonth);
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const employeeId = profile?.id;
  const isCurrent = month.year === currentMonth().year && month.month === currentMonth().month;

  const load = useCallback(async () => {
    if (!employeeId) return;
    try {
      setRows(await fetchMonth(employeeId, month.year, month.month));
      setError(null);
    } catch {
      setError("Gagal memuat riwayat. Periksa koneksi internet lalu tarik layar ke bawah.");
    }
  }, [employeeId, month]);

  // Muat ulang saat bulan berganti atau setelah absen hari ini berubah.
  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    fetchMonth(employeeId, month.year, month.month)
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Gagal memuat riwayat. Periksa koneksi internet lalu tarik layar ke bawah.");
      });
    return () => {
      active = false;
    };
  }, [employeeId, month, today?.check_in_at, today?.check_out_at]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), refreshProfile()]);
    setRefreshing(false);
  }

  function changeMonth(delta: number) {
    setRows(null);
    setMonth((m) => shiftMonth(m, delta));
  }

  const hadir = rows?.filter((r) => r.status === "hadir").length ?? 0;
  const sakit = rows?.filter((r) => r.status === "sakit").length ?? 0;
  const absen = rows?.filter((r) => r.status === "tidak_hadir").length ?? 0;
  const worked = (rows ?? []).map(workedMinutes).filter((m): m is number => m !== null);
  const totalMinutes = worked.reduce((a, b) => a + b, 0);

  return (
    <TabScreen title="Riwayat Absensi" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.monthBar}>
        <Pressable accessibilityLabel="Bulan sebelumnya" onPress={() => changeMonth(-1)} hitSlop={8} style={styles.monthBtn}>
          <Icon android="chevron_left" ios="chevron.left" size={22} color={c.onSurface} />
        </Pressable>
        <Text style={styles.monthText}>{monthLabel(month)}</Text>
        <Pressable
          accessibilityLabel="Bulan berikutnya"
          onPress={() => changeMonth(1)}
          disabled={isCurrent}
          hitSlop={8}
          style={[styles.monthBtn, isCurrent && { opacity: 0.3 }]}
        >
          <Icon android="chevron_right" ios="chevron.right" size={22} color={c.onSurface} />
        </Pressable>
      </View>

      {!profile ? (
        profileError ? (
          <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Data belum bisa dimuat" message={profileError}>
            <View style={{ marginTop: 8 }}>
              <ActionButton label="Coba lagi" variant="secondary" onPress={onRefresh} />
            </View>
          </Notice>
        ) : (
          <LoadingCard />
        )
      ) : (
        <>
          <Card>
            <CardTitle icon={{ android: "monitoring", ios: "chart.bar" }} label="Statistik Bulan Ini" />
            <View style={styles.statGrid}>
              <StatBox label="Hadir" value={String(hadir)} unit="hari" tone={c.success} />
              <StatBox label="Sakit" value={String(sakit)} unit="hari" tone={c.warning} />
              <StatBox label="Tidak Hadir" value={String(absen)} unit="hari" tone={c.absent} />
              <StatBox label="Jam Kerja" value={String(Math.floor(totalMinutes / 60))} unit="jam" tone={colors.brand} />
            </View>
            {worked.length > 0 && (
              <Text style={kit.muted}>Rata-rata {formatDuration(Math.round(totalMinutes / worked.length))} per hari (dari jam masuk–pulang).</Text>
            )}
          </Card>

          {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Riwayat belum dimuat" message={error} />}

          {rows === null && !error ? (
            <LoadingCard label="Memuat riwayat…" />
          ) : rows && rows.length === 0 ? (
            <Card style={{ alignItems: "center", paddingVertical: 28 }}>
              <Icon android="event_busy" ios="calendar.badge.exclamationmark" size={28} color={c.outline} />
              <Text style={[kit.muted, { marginTop: 8 }]}>Belum ada data absensi di bulan ini.</Text>
            </Card>
          ) : (
            rows?.map((row) => <DayCard key={row.id} row={row} />)
          )}
        </>
      )}
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.card,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  monthBtn: { padding: 8, borderRadius: 8, backgroundColor: c.cardHigh },
  monthText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 15 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexBasis: "47%", flexGrow: 1, backgroundColor: c.input, borderRadius: 10, padding: 12, gap: 4 },
  statValue: { fontFamily: fonts.bold, fontSize: 24 },
  statUnit: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12 },

  dayHeader: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  dayTitle: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  today: { color: colors.brand, fontFamily: fonts.medium, fontSize: 12 },
  times: { flexDirection: "row", gap: 10, backgroundColor: c.input, borderRadius: 10, padding: 12 },
  timeCol: { flex: 1, gap: 4 },
  timeLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 18, fontVariant: ["tabular-nums"] },
}));

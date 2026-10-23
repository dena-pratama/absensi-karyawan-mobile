import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ActionButton, Card, kit, LoadingCard, Notice, Pill, TabScreen, type Tone } from "@/components/kit";
import { BranchChips, DateStepper } from "@/components/pickers";
import { useAuth } from "@/lib/auth";
import { fetchDayRoster, saveChecklist, useSpv, type DayAttendance, type RosterEntry } from "@/lib/spv";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatTimeWIB, todayWIB } from "@/shared/format";
import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/shared/labels";

const STATUSES: { value: AttendanceStatus; tone: Tone }[] = [
  { value: "hadir", tone: "success" },
  { value: "sakit", tone: "warning" },
  { value: "tidak_hadir", tone: "danger" },
];

/** Warna tombol status (dibaca saat render supaya ikut tema aktif). */
function toneColor(s: AttendanceStatus): string {
  return s === "hadir" ? c.success : s === "sakit" ? c.warning : c.absent;
}

type Day = { roster: RosterEntry[]; attendance: DayAttendance[] };

function RosterCard({
  entry,
  record,
  draft,
  onPick,
  disabled,
}: {
  entry: RosterEntry;
  record: DayAttendance | undefined;
  draft: AttendanceStatus | undefined;
  onPick: (s: AttendanceStatus) => void;
  disabled: boolean;
}) {
  const away = entry.backup?.kind === "out";
  const current = draft ?? record?.status;
  return (
    <Card style={away ? { opacity: 0.7 } : undefined}>
      <View style={styles.rowHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={kit.strong} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={kit.muted} numberOfLines={1}>
            {entry.nik} • {entry.roleName}
          </Text>
        </View>
        {entry.backup?.kind === "in" && <Pill tone="info" label={`Backup dari ${entry.backup.branchCode}`} />}
        {away && <Pill tone="muted" label={`Sedang backup di ${entry.backup!.branchCode}`} />}
      </View>

      {record?.checkInAt ? (
        <Text style={kit.muted}>
          GPS: masuk {formatTimeWIB(record.checkInAt)}
          {record.checkOutAt ? ` • pulang ${formatTimeWIB(record.checkOutAt)}` : " • belum pulang"}
        </Text>
      ) : null}

      {away ? (
        <Text style={kit.muted}>
          Diabsen di cabang {entry.backup!.branchCode} - {entry.backup!.branchName}
          {record ? ` • ${ATTENDANCE_LABEL[record.status]}` : ""}. Hanya bisa dilihat.
        </Text>
      ) : (
        <View style={styles.segment}>
          {STATUSES.map((s) => {
            const active = current === s.value;
            return (
              <Pressable
                key={s.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                disabled={disabled}
                onPress={() => onPick(s.value)}
                style={[styles.segBtn, active && { backgroundColor: toneColor(s.value) }]}
              >
                <Text style={[styles.segText, active && { color: c.surface }]}>{ATTENDANCE_LABEL[s.value]}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {draft && draft !== record?.status ? <Text style={styles.changed}>Belum disimpan</Text> : null}
    </Card>
  );
}

/** Ceklis & monitoring absensi harian per cabang (termasuk karyawan backup). */
export default function SpvChecklist() {
  const { session } = useAuth();
  const { branches, branchId, setBranchId, loading, error: branchError, refresh: refreshBranches } = useSpv();
  const today = todayWIB();
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      setDay(await fetchDayRoster(branchId, date));
      setError(null);
    } catch {
      setError("Gagal memuat daftar karyawan. Periksa koneksi internet lalu tarik layar ke bawah.");
    }
  }, [branchId, date]);

  useEffect(() => {
    if (!branchId) return;
    let active = true;
    fetchDayRoster(branchId, date)
      .then((d) => {
        if (!active) return;
        setDay(d);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Gagal memuat daftar karyawan. Periksa koneksi internet lalu tarik layar ke bawah.");
      });
    return () => {
      active = false;
    };
  }, [branchId, date]);

  function reset() {
    setDay(null);
    setDrafts({});
    setMessage(null);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshBranches(), load()]);
    setRefreshing(false);
  }

  const changes = Object.entries(drafts)
    .filter(([id, s]) => day?.attendance.find((a) => a.employeeId === id)?.status !== s)
    .map(([employeeId, status]) => ({ employeeId, status }));

  async function save() {
    if (!branchId || !day || !session) return;
    setSaving(true);
    setMessage(null);
    const err = await saveChecklist(branchId, date, day.roster, changes, session.user.id);
    if (err) {
      setMessage(err);
    } else {
      setDrafts({});
      setMessage(`${changes.length} data absensi tersimpan.`);
      await load();
    }
    setSaving(false);
  }

  const counts = { hadir: 0, sakit: 0, tidak_hadir: 0, kosong: 0 };
  for (const r of day?.roster ?? []) {
    if (r.backup?.kind === "out") continue;
    const s = drafts[r.employeeId] ?? day?.attendance.find((a) => a.employeeId === r.employeeId)?.status;
    counts[s ?? "kosong"] += 1;
  }

  return (
    <TabScreen title="Ceklis Absensi" refreshing={refreshing} onRefresh={onRefresh}>
      {loading ? (
        <LoadingCard label="Memuat cabang…" />
      ) : branchError ? (
        <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Cabang belum bisa dimuat" message={branchError} />
      ) : branches.length === 0 ? (
        <Notice
          tone="warning"
          icon={{ android: "warehouse", ios: "building.2" }}
          title="Belum ada cabang"
          message="Akun SPV ini belum diberi cabang. Hubungi admin."
        />
      ) : (
        <>
          {branches.length > 1 && (
            <BranchChips
              branches={branches}
              value={branchId}
              onChange={(id) => {
                reset();
                setBranchId(id);
              }}
            />
          )}
          <DateStepper
            value={date}
            max={today}
            onChange={(d) => {
              reset();
              setDate(d);
            }}
          />

          {day && (
            <View style={styles.summary}>
              <Pill tone="success" label={`Hadir ${counts.hadir}`} />
              <Pill tone="warning" label={`Sakit ${counts.sakit}`} />
              <Pill tone="danger" label={`Tidak hadir ${counts.tidak_hadir}`} />
              <Pill tone="muted" label={`Belum diisi ${counts.kosong}`} />
            </View>
          )}

          {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Data belum dimuat" message={error} />}
          {message && (
            <Notice
              tone={message.includes("tersimpan") ? "success" : "danger"}
              icon={message.includes("tersimpan") ? { android: "task_alt", ios: "checkmark.circle" } : { android: "error", ios: "exclamationmark.circle" }}
              title={message}
            />
          )}

          {!day && !error ? (
            <LoadingCard label="Memuat karyawan…" />
          ) : day && day.roster.length === 0 ? (
            <Notice tone="muted" icon={{ android: "group_off", ios: "person.2.slash" }} title="Belum ada karyawan di cabang ini pada tanggal tersebut." />
          ) : (
            day?.roster.map((r) => (
              <RosterCard
                key={r.employeeId}
                entry={r}
                record={day.attendance.find((a) => a.employeeId === r.employeeId)}
                draft={drafts[r.employeeId]}
                onPick={(s) => setDrafts((d) => ({ ...d, [r.employeeId]: s }))}
                disabled={saving}
              />
            ))
          )}

          {changes.length > 0 && (
            <ActionButton
              label={`Simpan ${changes.length} perubahan`}
              icon={{ android: "save", ios: "square.and.arrow.down" }}
              onPress={save}
              loading={saving}
            />
          )}
        </>
      )}
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  rowHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  segment: { flexDirection: "row", gap: 6 },
  segBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: c.input,
  },
  segText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 12 },
  changed: { color: colors.brand, fontFamily: fonts.medium, fontSize: 11 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
}));

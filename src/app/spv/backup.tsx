import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton, Card, ChipButton, kit, LoadingCard, Notice, Pill, TabScreen } from "@/components/kit";
import { addDays, DateStepper, SelectField } from "@/components/pickers";
import { useAuth } from "@/lib/auth";
import { fetchBackups, formatRange, type Backup } from "@/lib/backup";
import {
  deleteBackup,
  fetchAllBranches,
  fetchBranchEmployees,
  fetchBranchNames,
  saveBackup,
  useSpv,
  type BranchOption,
  type EmployeeOption,
} from "@/lib/spv";
import { appColors as c, fonts, themedStyles } from "@/lib/theme";
import { todayWIB } from "@/shared/format";

/** Rentang backup maksimal 93 hari (date_to − date_from ≤ 92), sama dengan database. */
const MAX_SPAN_DAYS = 92;

type FormState = {
  id?: string;
  employeeId: string | null;
  toBranchId: string | null;
  dateFrom: string;
  dateTo: string;
  note: string;
};

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Batal", style: "cancel", onPress: () => resolve(false) },
      { text: "Hapus", style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

function BackupForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { branches } = useSpv();
  const isOffice = useAuth().role === "office";
  const today = todayWIB();
  const [form, setForm] = useState(initial);
  const [employees, setEmployees] = useState<EmployeeOption[] | null>(null);
  const [allBranches, setAllBranches] = useState<BranchOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pilihan karyawan = yang ditempatkan di cabang SPV pada tanggal mulai backup.
  useEffect(() => {
    let active = true;
    Promise.all([fetchBranchEmployees(branches, form.dateFrom, isOffice), fetchAllBranches()])
      .then(([emps, all]) => {
        if (!active) return;
        setEmployees(emps);
        setAllBranches(all);
      })
      .catch(() => {
        if (active) setError("Gagal memuat pilihan karyawan / cabang. Periksa koneksi internet.");
      });
    return () => {
      active = false;
    };
  }, [branches, form.dateFrom, isOffice]);

  // Karyawan yang sedang diedit tetap muncul walau sudah tidak di cabang SPV.
  const employeeOptions = [
    ...(employees ?? []),
    ...(initial.id && initial.employeeId && !(employees ?? []).some((e) => e.id === initial.employeeId)
      ? [{ id: initial.employeeId, nik: "", name: "Karyawan saat ini", branchCode: "" }]
      : []),
  ].map((e) => ({ id: e.id, title: e.name, subtitle: [e.nik, e.branchCode].filter(Boolean).join(" • ") }));
  const branchOptions = (allBranches ?? []).map((b) => ({ id: b.id, title: `${b.code} - ${b.name}` }));
  const minFrom = initial.id && initial.dateFrom < today ? initial.dateFrom : today;

  async function submit() {
    if (!form.employeeId || !form.toBranchId) {
      setError("Pilih karyawan dan cabang tujuan.");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await saveBackup(
      {
        employeeId: form.employeeId,
        toBranchId: form.toBranchId,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        note: form.note,
      },
      form.id,
    );
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{form.id ? "Ubah Backup" : "Tambah Backup"}</Text>
              <ChipButton label="Tutup" icon={{ android: "close", ios: "xmark" }} onPress={onClose} />
            </View>
            <Text style={kit.muted}>
              Karyawan dipinjam sementara ke cabang lain. Selama tanggal backup, karyawan absen di cabang tujuan dan
              absensinya dihitung di sana.
            </Text>

            {!employees && !error ? (
              <LoadingCard label="Memuat pilihan…" />
            ) : (
              <>
                <SelectField
                  label="Karyawan"
                  placeholder="Pilih karyawan dari cabang Anda"
                  options={employeeOptions}
                  value={form.employeeId}
                  onChange={(id) => setForm((f) => ({ ...f, employeeId: id }))}
                />
                <SelectField
                  label="Cabang tujuan"
                  placeholder="Pilih cabang tujuan"
                  options={branchOptions}
                  value={form.toBranchId}
                  onChange={(id) => setForm((f) => ({ ...f, toBranchId: id }))}
                />
              </>
            )}

            <DateStepper
              label="Tanggal mulai"
              value={form.dateFrom}
              min={minFrom}
              onChange={(d) =>
                setForm((f) => {
                  // Tanggal selesai ikut bergeser supaya lama backup tetap sama.
                  const span = Math.round((Date.parse(f.dateTo) - Date.parse(f.dateFrom)) / 86400000);
                  return { ...f, dateFrom: d, dateTo: addDays(d, span) };
                })
              }
            />
            <DateStepper
              label="Tanggal selesai"
              value={form.dateTo}
              min={form.dateFrom}
              max={addDays(form.dateFrom, MAX_SPAN_DAYS)}
              onChange={(d) => setForm((f) => ({ ...f, dateTo: d }))}
            />
            <Text style={kit.muted}>
              {form.dateFrom === form.dateTo
                ? "Backup 1 hari."
                : `Backup ${Math.round((Date.parse(form.dateTo) - Date.parse(form.dateFrom)) / 86400000) + 1} hari.`}{" "}
              Maksimal 93 hari.
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={kit.label}>Keterangan (opsional)</Text>
              <TextInput
                value={form.note}
                onChangeText={(note) => setForm((f) => ({ ...f, note }))}
                placeholder="mis. bantu sortir paket akhir bulan"
                placeholderTextColor={c.outlineVariant}
                style={styles.input}
                maxLength={200}
                multiline
              />
            </View>

            {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Belum tersimpan" message={error} />}

            <ActionButton
              label={form.id ? "Simpan Perubahan" : "Simpan Backup"}
              icon={{ android: "save", ios: "square.and.arrow.down" }}
              onPress={submit}
              loading={saving}
              disabled={!employees}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function BackupCard({ b, onEdit, onDelete }: { b: Backup; onEdit: () => void; onDelete: () => void }) {
  const today = todayWIB();
  const active = b.dateFrom <= today && today <= b.dateTo;
  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={kit.strong}>{b.employeeName}</Text>
          <Text style={kit.muted}>{b.nik}</Text>
        </View>
        <Pill tone={active ? "success" : "info"} label={active ? "Aktif" : "Akan datang"} />
      </View>
      <Text style={kit.body}>
        {b.fromBranch?.code ?? "-"} → {b.toBranch.code} - {b.toBranch.name}
      </Text>
      <Text style={kit.muted}>
        {formatRange(b.dateFrom, b.dateTo)}
        {b.note ? ` • ${b.note}` : ""}
      </Text>
      <View style={styles.cardActions}>
        <ChipButton label="Ubah" icon={{ android: "edit", ios: "pencil" }} onPress={onEdit} />
        <ChipButton label="Hapus" icon={{ android: "delete", ios: "trash" }} onPress={onDelete} />
      </View>
    </Card>
  );
}

/** Daftar & kelola penugasan backup yang melibatkan cabang-cabang SPV (aktif & akan datang). */
export default function SpvBackup() {
  const { branches, loading: branchesLoading } = useSpv();
  const today = todayWIB();
  const [rows, setRows] = useState<Backup[] | null>(null);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchBranchNames().then((names) => fetchBackups({ since: today, names }));
      setRows(result.rows);
      setReady(result.ready);
      setError(null);
    } catch {
      setError("Gagal memuat daftar backup. Periksa koneksi internet lalu tarik layar ke bawah.");
    }
  }, [today]);

  useEffect(() => {
    let active = true;
    fetchBranchNames().then((names) => fetchBackups({ since: today, names }))
      .then((result) => {
        if (!active) return;
        setRows(result.rows);
        setReady(result.ready);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Gagal memuat daftar backup. Periksa koneksi internet lalu tarik layar ke bawah.");
      });
    return () => {
      active = false;
    };
  }, [today]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function remove(b: Backup) {
    const ok = await confirm("Hapus backup?", `${b.employeeName} ke ${b.toBranch.code} (${formatRange(b.dateFrom, b.dateTo)}).`);
    if (!ok) return;
    const err = await deleteBackup(b.id);
    setMessage(err ?? "Backup dihapus.");
    await load();
  }

  return (
    <TabScreen title="Backup Karyawan" refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={kit.muted}>
        Karyawan cabang Anda yang dipinjam ke cabang lain, atau karyawan cabang lain yang membantu di cabang Anda.
      </Text>

      {!ready ? (
        <Notice
          tone="warning"
          icon={{ android: "build", ios: "wrench" }}
          title="Fitur backup belum aktif"
          message="Migrasi database untuk backup belum dijalankan. Hubungi admin."
        />
      ) : (
        <ActionButton
          label="Tambah Backup"
          icon={{ android: "add", ios: "plus" }}
          disabled={branchesLoading || branches.length === 0}
          onPress={() => {
            setMessage(null);
            setForm({ employeeId: null, toBranchId: null, dateFrom: today, dateTo: today, note: "" });
          }}
        />
      )}

      {message && (
        <Notice
          tone={message === "Backup dihapus." || message === "Backup tersimpan." ? "success" : "danger"}
          icon={{ android: "info", ios: "info.circle" }}
          title={message}
        />
      )}
      {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Data belum dimuat" message={error} />}

      {rows === null && !error ? (
        <LoadingCard label="Memuat backup…" />
      ) : rows && rows.length === 0 && ready ? (
        <Notice tone="muted" icon={{ android: "event_available", ios: "calendar" }} title="Tidak ada backup aktif atau yang akan datang." />
      ) : (
        rows?.map((b) => (
          <BackupCard
            key={b.id}
            b={b}
            onEdit={() => {
              setMessage(null);
              setForm({
                id: b.id,
                employeeId: b.employeeId,
                toBranchId: b.toBranch.id,
                dateFrom: b.dateFrom,
                dateTo: b.dateTo,
                note: b.note,
              });
            }}
            onDelete={() => remove(b)}
          />
        ))
      )}

      {form && (
        <BackupForm
          initial={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            setMessage("Backup tersimpan.");
            load();
          }}
        />
      )}
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  modal: { flex: 1, backgroundColor: c.surface },
  form: { padding: 16, gap: 16, paddingBottom: 40 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 20 },
  input: {
    minHeight: 72,
    backgroundColor: c.input,
    borderRadius: 10,
    padding: 12,
    color: c.onSurface,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlignVertical: "top",
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cardActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
}));

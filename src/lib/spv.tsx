// Data untuk akun SPV: cabang yang dipegang (boleh > 1), roster harian (termasuk karyawan backup),
// ceklis absensi, dan penugasan backup. SPV tidak absen sendiri.
// Logika roster mengikuti panel web (absensi-karyawan/src/lib/data/backup.ts → getDayRoster).

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

import type { AttendanceStatus } from "@/shared/labels";
import { useAuth } from "./auth";
import { BRANCH_COLUMNS, fetchBackups, isMissingSchema } from "./backup";
import type { BranchInfo } from "./employee";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Cabang SPV (context bersama untuk semua tab SPV)
// ---------------------------------------------------------------------------

type SpvState = {
  loading: boolean;
  error: string | null;
  branches: BranchInfo[];
  /** Cabang yang sedang dipilih di pemilih cabang. */
  branchId: string | null;
  setBranchId: (id: string) => void;
  refresh: () => Promise<void>;
};

const SpvContext = createContext<SpvState | null>(null);

async function loadBranches(userId: string): Promise<BranchInfo[]> {
  const { data, error } = await supabase
    .from("app_user_branch")
    .select(`branch:branch_id(${BRANCH_COLUMNS})`)
    .eq("user_id", userId);
  if (!error) {
    return ((data ?? []) as unknown as { branch: BranchInfo | null }[])
      .map((r) => r.branch)
      .filter((b): b is BranchInfo => !!b)
      .sort((a, b) => a.code.localeCompare(b.code));
  }
  if (!isMissingSchema(error)) throw error;

  // Migrasi multi-cabang belum dijalankan → pakai cabang tunggal app_user.branch_id.
  const { data: me, error: meError } = await supabase
    .from("app_user")
    .select(`branch:branch_id(${BRANCH_COLUMNS})`)
    .eq("user_id", userId)
    .maybeSingle();
  if (meError) throw meError;
  const branch = (me as unknown as { branch: BranchInfo | null } | null)?.branch;
  return branch ? [branch] : [];
}

export function SpvProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<{ loading: boolean; error: string | null; branches: BranchInfo[] }>({
    loading: true,
    error: null,
    branches: [],
  });
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const branches = await loadBranches(uid);
      return { loading: false, error: null, branches };
    } catch {
      return { loading: false, error: "Gagal memuat daftar cabang. Periksa koneksi internet lalu coba lagi.", branches: [] };
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    load(userId).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [userId, load]);

  const refresh = useCallback(async () => {
    if (userId) setState(await load(userId));
  }, [userId, load]);

  // Pilihan cabang tetap selama masih ada di daftar; kalau tidak, pakai cabang pertama.
  const branchId = state.branches.some((b) => b.id === picked) ? picked : (state.branches[0]?.id ?? null);

  return (
    <SpvContext value={{ ...state, branchId, setBranchId: setPicked, refresh }}>{children}</SpvContext>
  );
}

export function useSpv(): SpvState {
  const ctx = use(SpvContext);
  if (!ctx) throw new Error("useSpv harus dipakai di dalam <SpvProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Roster harian + ceklis
// ---------------------------------------------------------------------------

export type RosterEntry = {
  employeeId: string;
  nik: string;
  name: string;
  roleId: string;
  roleName: string;
  /** in = karyawan cabang lain yang di-backup ke sini; out = karyawan cabang ini yang sedang backup di cabang lain. */
  backup: { kind: "in" | "out"; branchCode: string; branchName: string } | null;
};

export type DayAttendance = {
  employeeId: string;
  branchId: string;
  status: AttendanceStatus;
  note: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
};

type AssignmentRow = {
  employee_id: string;
  job_role_id: string;
  employee: { nik: string; full_name: string } | null;
  job_role: { name: string } | null;
};

/** Karyawan aktif yang ditempatkan di cabang (atau karyawan tertentu) pada tanggal itu. */
async function queryRoster(by: { branchId: string } | { employeeIds: string[] }, date: string) {
  let q = supabase
    .from("employee_assignment")
    .select("employee_id, job_role_id, employee:employee_id!inner(nik, full_name), job_role:job_role_id(name)")
    .eq("employee.is_active", true)
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .order("valid_from", { ascending: false });
  q = "branchId" in by ? q.eq("branch_id", by.branchId) : q.in("employee_id", by.employeeIds);
  const { data, error } = await q;
  if (error) throw error;

  const seen = new Set<string>();
  const roster: Omit<RosterEntry, "backup">[] = [];
  for (const row of (data ?? []) as unknown as AssignmentRow[]) {
    if (!row.employee || seen.has(row.employee_id)) continue;
    seen.add(row.employee_id);
    roster.push({
      employeeId: row.employee_id,
      nik: row.employee.nik,
      name: row.employee.full_name,
      roleId: row.job_role_id,
      roleName: row.job_role?.name ?? "-",
    });
  }
  return roster;
}

/** Roster satu cabang pada satu tanggal + absensinya. */
export async function fetchDayRoster(branchId: string, date: string) {
  const [home, { rows: backups }] = await Promise.all([
    queryRoster({ branchId }, date),
    fetchBackups({ since: date, until: date }),
  ]);
  const out = new Map(backups.filter((b) => b.fromBranch?.id === branchId).map((b) => [b.employeeId, b]));
  const incoming = backups.filter((b) => b.toBranch.id === branchId);
  const homeIds = new Set(home.map((r) => r.employeeId));
  const visiting =
    incoming.length > 0 ? await queryRoster({ employeeIds: incoming.map((b) => b.employeeId) }, date) : [];

  const roster: RosterEntry[] = [
    ...home.map((r) => {
      const b = out.get(r.employeeId);
      return { ...r, backup: b ? { kind: "out" as const, branchCode: b.toBranch.code, branchName: b.toBranch.name } : null };
    }),
    ...visiting
      .filter((r) => !homeIds.has(r.employeeId))
      .map((r) => {
        const b = incoming.find((x) => x.employeeId === r.employeeId);
        return {
          ...r,
          backup: { kind: "in" as const, branchCode: b?.fromBranch?.code ?? "-", branchName: b?.fromBranch?.name ?? "-" },
        };
      }),
  ].sort((a, b) => a.nik.localeCompare(b.nik));

  const ids = roster.map((r) => r.employeeId);
  let attendance: DayAttendance[] = [];
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("employee_id, branch_id, status, note, check_in_at, check_out_at")
      .in("employee_id", ids)
      .eq("attendance_date", date);
    if (error) throw error;
    attendance = (
      (data ?? []) as {
        employee_id: string;
        branch_id: string;
        status: AttendanceStatus;
        note: string | null;
        check_in_at: string | null;
        check_out_at: string | null;
      }[]
    ).map((r) => ({
      employeeId: r.employee_id,
      branchId: r.branch_id,
      status: r.status,
      note: r.note,
      checkInAt: r.check_in_at,
      checkOutAt: r.check_out_at,
    }));
  }
  return { roster, attendance };
}

/**
 * Simpan ceklis (status per karyawan) untuk satu cabang & tanggal — seperti saveAttendance di web.
 * Karyawan yang sedang backup keluar tidak boleh diisi di sini. Kolom check-in/out tidak disentuh.
 */
export async function saveChecklist(
  branchId: string,
  date: string,
  roster: RosterEntry[],
  changes: { employeeId: string; status: AttendanceStatus }[],
  userId: string,
): Promise<string | null> {
  const byId = new Map(roster.filter((r) => r.backup?.kind !== "out").map((r) => [r.employeeId, r]));
  const rows = [];
  for (const c of changes) {
    const emp = byId.get(c.employeeId);
    if (!emp) return "Ada karyawan yang tidak terdaftar di cabang ini pada tanggal tersebut.";
    rows.push({
      attendance_date: date,
      employee_id: c.employeeId,
      branch_id: branchId,
      job_role_id: emp.roleId,
      status: c.status,
      updated_by: userId,
    });
  }
  if (rows.length === 0) return null;

  const { data: existing, error: existingError } = await supabase
    .from("attendance_daily")
    .select("employee_id")
    .eq("attendance_date", date)
    .in(
      "employee_id",
      rows.map((r) => r.employee_id),
    );
  if (existingError) return "Gagal membaca data absensi. Coba lagi.";
  const existingIds = new Set((existing ?? []).map((e) => e.employee_id as string));
  const toInsert = rows.filter((r) => !existingIds.has(r.employee_id)).map((r) => ({ ...r, created_by: userId }));
  const toUpdate = rows.filter((r) => existingIds.has(r.employee_id));

  if (toInsert.length) {
    const { error } = await supabase.from("attendance_daily").insert(toInsert);
    if (error) return "Gagal menyimpan absensi baru. Coba lagi.";
  }
  if (toUpdate.length) {
    const { error } = await supabase.from("attendance_daily").upsert(toUpdate, { onConflict: "employee_id,attendance_date" });
    if (error) return "Gagal memperbarui absensi. Coba lagi.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Backup karyawan (SPV)
// ---------------------------------------------------------------------------

export type BranchOption = { id: string; code: string; name: string };

/** Semua cabang (pilihan cabang tujuan backup). Tabel branch tidak punya status aktif. */
export async function fetchAllBranches(): Promise<BranchOption[]> {
  const { data, error } = await supabase.from("branch").select("id, code, name").order("code");
  if (error) throw error;
  return (data ?? []) as BranchOption[];
}

export type EmployeeOption = { id: string; nik: string; name: string; branchCode: string };

/** Karyawan yang ditempatkan di cabang-cabang SPV pada tanggal itu (pilihan karyawan backup). */
export async function fetchBranchEmployees(branches: BranchInfo[], date: string): Promise<EmployeeOption[]> {
  const lists = await Promise.all(branches.map((b) => queryRoster({ branchId: b.id }, date)));
  const seen = new Set<string>();
  const result: EmployeeOption[] = [];
  lists.forEach((list, i) => {
    for (const r of list) {
      if (seen.has(r.employeeId)) continue;
      seen.add(r.employeeId);
      result.push({ id: r.employeeId, nik: r.nik, name: r.name, branchCode: branches[i].code });
    }
  });
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export type BackupInput = {
  employeeId: string;
  toBranchId: string;
  dateFrom: string;
  dateTo: string;
  note: string;
};

function backupError(error: { code?: string; message: string }): string {
  // Pesan dari trigger validasi (P0001) sudah berbahasa Indonesia.
  if (error.code === "P0001") return error.message;
  if (error.code === "23514") return "Rentang tanggal tidak valid (tanggal selesai ≥ tanggal mulai, maksimal 93 hari).";
  if (error.code === "42501") return "Anda tidak berhak mengubah backup ini (harus melibatkan cabang Anda).";
  if (isMissingSchema(error)) return "Fitur backup belum aktif di server (migrasi database belum dijalankan). Hubungi admin.";
  if (/network|fetch|timeout/i.test(error.message)) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
  return "Gagal menyimpan backup. Coba lagi.";
}

export async function saveBackup(input: BackupInput, id?: string): Promise<string | null> {
  const row = {
    employee_id: input.employeeId,
    to_branch_id: input.toBranchId,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    note: input.note.trim() || null,
  };
  const { error } = id
    ? await supabase.from("employee_backup").update(row).eq("id", id)
    : await supabase.from("employee_backup").insert(row);
  return error ? backupError(error) : null;
}

export async function deleteBackup(id: string): Promise<string | null> {
  const { error } = await supabase.from("employee_backup").delete().eq("id", id);
  return error ? backupError(error) : null;
}

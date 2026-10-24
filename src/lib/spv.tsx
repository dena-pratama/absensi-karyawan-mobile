// Data untuk akun SPV: cabang yang dipegang (boleh > 1) dan penugasan backup karyawan.
// Absen SPV sendiri ada di CheckScreen (pilih outlet). Ceklis absensi cabang hanya lewat panel web.

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { useAuth } from "./auth";
import { BRANCH_COLUMNS, isMissingSchema } from "./backup";
import type { BranchInfo } from "./employee";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Cabang SPV (context bersama untuk semua tab SPV)
// ---------------------------------------------------------------------------

type SpvState = {
  loading: boolean;
  error: string | null;
  branches: BranchInfo[];
  /** Outlet yang boleh dipakai absen hari ini (dari server). Office: semua cabang aktif. */
  checkinBranches: BranchInfo[];
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

/**
 * Outlet absen hari ini lewat fungsi my_checkin_branches() (karyawan: penempatan/backup; SPV: + cabangnya;
 * Office: + semua cabang aktif). RLS tabel branch tidak mengizinkan Office membaca cabang yang tidak dipegang,
 * jadi daftar ini wajib dari server. Fungsi belum ada (migrasi office_role belum dijalankan) → cabang SPV.
 */
async function loadCheckinBranches(fallback: BranchInfo[]): Promise<BranchInfo[]> {
  const { data, error } = await supabase.rpc("my_checkin_branches");
  if (error) {
    if (isMissingSchema(error)) return fallback;
    throw error;
  }
  return ((data ?? []) as BranchInfo[]).sort((a, b) => a.code.localeCompare(b.code));
}

export function SpvProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    branches: BranchInfo[];
    checkinBranches: BranchInfo[];
  }>({
    loading: true,
    error: null,
    branches: [],
    checkinBranches: [],
  });

  const load = useCallback(async (uid: string) => {
    try {
      const branches = await loadBranches(uid);
      const checkinBranches = await loadCheckinBranches(branches);
      return { loading: false, error: null, branches, checkinBranches };
    } catch {
      return {
        loading: false,
        error: "Gagal memuat daftar cabang. Periksa koneksi internet lalu coba lagi.",
        branches: [],
        checkinBranches: [],
      };
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


  return (
    <SpvContext value={{ ...state, refresh }}>{children}</SpvContext>
  );
}

export function useSpv(): SpvState {
  const ctx = use(SpvContext);
  if (!ctx) throw new Error("useSpv harus dipakai di dalam <SpvProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Karyawan per cabang (pilihan karyawan backup)
// ---------------------------------------------------------------------------

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
  const roster: { employeeId: string; nik: string; name: string; roleId: string; roleName: string }[] = [];
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

// ---------------------------------------------------------------------------
// Backup karyawan (SPV)
// ---------------------------------------------------------------------------

export type BranchOption = { id: string; code: string; name: string };

/**
 * Semua cabang aktif untuk pilihan cabang tujuan backup, lewat fungsi backup_branch_options()
 * (khusus admin & SPV). Tabel branch sendiri hanya bisa dibaca untuk cabang milik SPV (RLS).
 */
export async function fetchAllBranches(): Promise<BranchOption[]> {
  const { data, error } = await supabase.rpc("backup_branch_options");
  if (!error) return (data ?? []) as BranchOption[];
  if (!isMissingSchema(error)) throw error;
  // Migrasi branch_visibility_fix belum dijalankan → policy lama masih mengizinkan baca tabel branch.
  const fallback = await supabase.from("branch").select("id, code, name").order("code");
  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as BranchOption[];
}

/** Peta id cabang → kode & nama, untuk menampilkan cabang lain pada data backup. */
export async function fetchBranchNames(): Promise<Map<string, { code: string; name: string }>> {
  try {
    return new Map((await fetchAllBranches()).map((b) => [b.id, { code: b.code, name: b.name }]));
  } catch {
    return new Map(); // nama cabang lain tampil "-" / "Cabang lain"; data utama tetap tampil
  }
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

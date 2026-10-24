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

/**
 * Cabang yang dipegang akun ini.
 * - Office: SEMUA cabang otomatis (tidak memakai app_user_branch / app_user.branch_id, yang bisa kosong);
 *   dibaca langsung dari tabel branch (RLS mengembalikan semua cabang untuk Office).
 * - SPV: daftar cabang di app_user_branch.
 */
async function loadBranches(userId: string, isOffice: boolean): Promise<BranchInfo[]> {
  if (isOffice) {
    const { data, error } = await supabase.from("branch").select(BRANCH_COLUMNS).order("code");
    if (error) throw error;
    return (data ?? []) as BranchInfo[];
  }
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
 * Office: + semua cabang aktif). Aturan "boleh absen di mana" ada di server, jadi daftar ini dari server.
 * Fungsi belum ada (migrasi office_role belum dijalankan) → cabang yang dipegang.
 */
async function loadCheckinBranches(fallback: BranchInfo[]): Promise<BranchInfo[]> {
  // (Office: semua cabang aktif; cabang nonaktif hanya untuk melihat / mengisi data, bukan absen.)
  const { data, error } = await supabase.rpc("my_checkin_branches");
  if (error) {
    if (isMissingSchema(error)) return fallback;
    throw error;
  }
  return ((data ?? []) as BranchInfo[]).sort((a, b) => a.code.localeCompare(b.code));
}

export function SpvProvider({ children }: { children: ReactNode }) {
  const { session, role } = useAuth();
  const userId = session?.user.id;
  const isOffice = role === "office";
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
      const branches = await loadBranches(uid, isOffice);
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
  }, [isOffice]);

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
  branch_id: string;
  employee: { nik: string; full_name: string } | null;
};

/**
 * Karyawan aktif yang ditempatkan di cabang-cabang tertentu pada tanggal itu (satu query).
 * `branchIds` kosong (undefined) = semua yang boleh dibaca RLS, dipakai Office yang memegang semua cabang.
 */
async function queryAssignments(branchIds: string[] | undefined, date: string) {
  let q = supabase
    .from("employee_assignment")
    .select("employee_id, branch_id, employee:employee_id!inner(nik, full_name)")
    .eq("employee.is_active", true)
    .lte("valid_from", date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .order("valid_from", { ascending: false });
  if (branchIds) q = q.in("branch_id", branchIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AssignmentRow[];
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

/**
 * Karyawan yang ditempatkan di cabang-cabang yang dipegang pada tanggal itu (pilihan karyawan backup).
 * `allBranches` = Office (semua cabang, tanpa filter cabang).
 */
export async function fetchBranchEmployees(
  branches: BranchInfo[],
  date: string,
  allBranches = false,
): Promise<EmployeeOption[]> {
  if (!allBranches && branches.length === 0) return [];
  const rows = await queryAssignments(allBranches ? undefined : branches.map((b) => b.id), date);
  const code = new Map(branches.map((b) => [b.id, b.code]));
  // Satu karyawan bisa punya >1 penempatan dalam rentang (mutasi) → ambil yang terbaru (urutan query).
  const seen = new Set<string>();
  const result: EmployeeOption[] = [];
  for (const r of rows) {
    if (!r.employee || seen.has(r.employee_id)) continue;
    seen.add(r.employee_id);
    result.push({ id: r.employee_id, nik: r.employee.nik, name: r.employee.full_name, branchCode: code.get(r.branch_id) ?? "" });
  }
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

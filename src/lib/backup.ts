// Backup karyawan: dipinjam sementara ke cabang lain (rentang tanggal). Absensi hari itu dicatat di
// cabang tujuan. Tabel employee_backup dari migrasi backup_and_multi_branch_spv (repo web).

import type { BranchInfo } from "./employee";
import { supabase } from "./supabase";

export const BRANCH_COLUMNS = "id, code, name, latitude, longitude, geofence_radius_m";

export type Backup = {
  id: string;
  employeeId: string;
  employeeName: string;
  nik: string;
  fromBranch: { id: string; code: string; name: string } | null;
  toBranch: BranchInfo;
  dateFrom: string;
  dateTo: string;
  note: string;
};

type BackupRow = {
  id: string;
  employee_id: string;
  date_from: string;
  date_to: string;
  note: string | null;
  employee: { full_name: string; nik: string } | null;
  from_branch: { id: string; code: string; name: string } | null;
  to_branch: BranchInfo | null;
};

const BACKUP_COLUMNS =
  "id, employee_id, date_from, date_to, note, employee:employee_id(full_name, nik), " +
  `from_branch:from_branch_id(id, code, name), to_branch:to_branch_id(${BRANCH_COLUMNS})`;

/** true = tabel / fungsi belum ada di database (migrasi belum dijalankan). */
export function isMissingSchema(error: { code?: string }) {
  return error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42P01" || error.code === "42883";
}

/**
 * Backup yang masih berlaku atau akan datang (date_to >= sejak), terlama di atas.
 * RLS yang membatasi: karyawan → miliknya; SPV → yang masuk / keluar cabangnya.
 * ready=false bila tabelnya belum ada.
 */
export async function fetchBackups(opts: { since: string; until?: string; employeeId?: string }) {
  let q = supabase
    .from("employee_backup")
    .select(BACKUP_COLUMNS)
    .gte("date_to", opts.since)
    .order("date_from", { ascending: true });
  if (opts.until) q = q.lte("date_from", opts.until);
  if (opts.employeeId) q = q.eq("employee_id", opts.employeeId);
  const { data, error } = await q;
  if (error) {
    if (isMissingSchema(error)) return { ready: false, rows: [] as Backup[] };
    throw error;
  }
  const rows = ((data ?? []) as unknown as BackupRow[])
    .filter((r) => r.to_branch)
    .map(
      (r): Backup => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: r.employee?.full_name ?? "-",
        nik: r.employee?.nik ?? "-",
        fromBranch: r.from_branch,
        toBranch: r.to_branch!,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        note: r.note ?? "",
      }),
    );
  return { ready: true, rows };
}

/** "21 Okt" atau "21–23 Okt 2026" untuk rentang backup. */
export function formatRange(from: string, to: string) {
  const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T00:00:00Z`));
  if (from === to) return fmt(from, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
}

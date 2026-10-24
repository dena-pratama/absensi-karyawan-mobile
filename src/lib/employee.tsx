// Data karyawan yang sedang login (profil, cabang penempatan hari ini, backup) + absensi hari ini.
// Dipakai juga oleh SPV yang dihubungkan admin ke data karyawannya (SPV ikut absen).
// Dipakai bersama oleh tab Check In, Check Out, Riwayat, dan Profil.

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { todayWIB } from "@/shared/format";
import { attendsSelf } from "@/shared/labels";
import { selectAttendance, type AttendanceRow } from "./attendance";
import { BRANCH_COLUMNS, fetchBackups, type Backup } from "./backup";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type BranchInfo = {
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
};

export type EmployeeProfile = {
  id: string;
  full_name: string;
  nik: string;
  contract_type: "tetap" | "pkwt" | "mitra";
  join_date: string | null;
  /** Penempatan yang berlaku hari ini (WIB); null kalau belum ditempatkan admin. */
  branch: BranchInfo | null;
  jobRole: string | null;
  /** Penugasan backup ke cabang lain yang berlaku hari ini; null kalau tidak ada. */
  backupToday: Backup | null;
  /** Backup hari ini & yang akan datang. */
  backups: Backup[];
};

type EmployeeState = {
  loading: boolean;
  error: string | null;
  profile: EmployeeProfile | null;
  /** Baris absensi hari ini (WIB); null kalau belum ada. */
  today: AttendanceRow | null;
  refresh: () => Promise<void>;
};

const EmployeeContext = createContext<EmployeeState | null>(null);

type EmployeeQueryRow = Omit<EmployeeProfile, "branch" | "jobRole" | "backupToday" | "backups"> & {
  employee_assignment: {
    valid_from: string;
    valid_to: string | null;
    branch: BranchInfo | null;
    job_role: { name: string } | null;
  }[];
};

async function loadEmployee(userId: string) {
  const { data: me, error: meError } = await supabase
    .from("app_user")
    .select("employee_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (meError) throw meError;
  if (!me?.employee_id) throw new Error("no-employee");

  const { data, error } = await supabase
    .from("employee")
    .select(
      `id, full_name, nik, contract_type, join_date, employee_assignment(valid_from, valid_to, branch:branch_id(${BRANCH_COLUMNS}), job_role:job_role_id(name))`,
    )
    .eq("id", me.employee_id)
    .single();
  if (error) throw error;

  // Penempatan yang berlaku hari ini (bisa ada mutasi terjadwal dengan tanggal efektif di masa depan).
  const today = todayWIB();
  const row = data as unknown as EmployeeQueryRow;
  const active = row.employee_assignment
    .filter((a) => a.valid_from <= today && (a.valid_to === null || a.valid_to >= today))
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  const { rows: backups } = await fetchBackups({ since: today, employeeId: row.id });
  const profile: EmployeeProfile = {
    id: row.id,
    full_name: row.full_name,
    nik: row.nik,
    contract_type: row.contract_type,
    join_date: row.join_date,
    branch: active?.branch ?? null,
    jobRole: active?.job_role?.name ?? null,
    backupToday: backups.find((b) => b.dateFrom <= today && today <= b.dateTo) ?? null,
    backups,
  };

  const todayRow = await selectAttendance((columns) =>
    supabase.from("attendance_daily").select(columns).eq("employee_id", profile.id).eq("attendance_date", today).maybeSingle(),
  );

  return { profile, today: (todayRow as unknown as AttendanceRow | null) ?? null };
}

/** Pesan saat akun belum dihubungkan ke data karyawan (dipakai juga untuk menyembunyikan tombol absen). */
export const NOT_LINKED_KARYAWAN = "Akun ini belum terhubung ke data karyawan. Hubungi admin.";
export const NOT_LINKED_SPV =
  "Akun SPV / Office belum terhubung ke data karyawan, hubungi admin (Pengguna & Akses → Absen sebagai).";

/** Seperti loadEmployee, tapi error diubah jadi pesan ramah (string). */
async function loadEmployeeSafe(userId: string, isSpv: boolean) {
  try {
    return await loadEmployee(userId);
  } catch (e) {
    if (e instanceof Error && e.message === "no-employee") return isSpv ? NOT_LINKED_SPV : NOT_LINKED_KARYAWAN;
    return "Gagal memuat data. Periksa koneksi internet lalu coba lagi.";
  }
}

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const { session, role } = useAuth();
  const userId = session?.user.id;
  const isSpv = attendsSelf(role);
  const [state, setState] = useState<Omit<EmployeeState, "refresh">>({
    loading: true,
    error: null,
    profile: null,
    today: null,
  });

  const apply = useCallback((result: Awaited<ReturnType<typeof loadEmployee>> | string) => {
    setState((prev) =>
      typeof result === "string"
        ? { ...prev, loading: false, error: result } // data lama tetap tampil kalau ada
        : { loading: false, error: null, ...result },
    );
  }, []);

  const refresh = useCallback(async () => {
    if (userId) apply(await loadEmployeeSafe(userId, isSpv));
  }, [userId, isSpv, apply]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadEmployeeSafe(userId, isSpv).then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [userId, isSpv, apply]);

  return <EmployeeContext value={{ ...state, refresh }}>{children}</EmployeeContext>;
}

export function useEmployee(): EmployeeState {
  const ctx = use(EmployeeContext);
  if (!ctx) throw new Error("useEmployee harus dipakai di dalam <EmployeeProvider>");
  return ctx;
}

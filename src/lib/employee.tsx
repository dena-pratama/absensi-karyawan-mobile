// Data karyawan yang sedang login (profil, cabang penempatan aktif) + absensi hari ini.
// Dipakai bersama oleh tab Check In, Check Out, Riwayat, dan Profil.

import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { todayWIB } from "@/shared/format";
import { ATTENDANCE_COLUMNS, type AttendanceRow } from "./attendance";
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
  /** Penempatan aktif; null kalau belum ditempatkan admin. */
  branch: BranchInfo | null;
  jobRole: string | null;
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

type EmployeeQueryRow = Omit<EmployeeProfile, "branch" | "jobRole"> & {
  employee_assignment: { branch: BranchInfo | null; job_role: { name: string } | null }[];
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
      "id, full_name, nik, contract_type, join_date, employee_assignment(branch:branch_id(id, code, name, latitude, longitude, geofence_radius_m), job_role:job_role_id(name))",
    )
    .eq("id", me.employee_id)
    .is("employee_assignment.valid_to", null)
    .single();
  if (error) throw error;

  const row = data as unknown as EmployeeQueryRow;
  const active = row.employee_assignment[0];
  const profile: EmployeeProfile = {
    id: row.id,
    full_name: row.full_name,
    nik: row.nik,
    contract_type: row.contract_type,
    join_date: row.join_date,
    branch: active?.branch ?? null,
    jobRole: active?.job_role?.name ?? null,
  };

  const { data: today, error: todayError } = await supabase
    .from("attendance_daily")
    .select(ATTENDANCE_COLUMNS)
    .eq("employee_id", profile.id)
    .eq("attendance_date", todayWIB())
    .maybeSingle();
  if (todayError) throw todayError;

  return { profile, today: (today as unknown as AttendanceRow | null) ?? null };
}

/** Seperti loadEmployee, tapi error diubah jadi pesan ramah (string). */
async function loadEmployeeSafe(userId: string) {
  try {
    return await loadEmployee(userId);
  } catch (e) {
    return e instanceof Error && e.message === "no-employee"
      ? "Akun ini belum terhubung ke data karyawan. Hubungi admin."
      : "Gagal memuat data. Periksa koneksi internet lalu coba lagi.";
  }
}

export function EmployeeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
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
    if (userId) apply(await loadEmployeeSafe(userId));
  }, [userId, apply]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadEmployeeSafe(userId).then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [userId, apply]);

  return <EmployeeContext value={{ ...state, refresh }}>{children}</EmployeeContext>;
}

export function useEmployee(): EmployeeState {
  const ctx = use(EmployeeContext);
  if (!ctx) throw new Error("useEmployee harus dipakai di dalam <EmployeeProvider>");
  return ctx;
}

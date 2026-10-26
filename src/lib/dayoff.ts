// Libur: jatah libur per periode gajian, pengajuan libur, off pengganti, pindah off, dan tukar off dengan rekan.
// Semua aturan & perubahan lewat fungsi day_off_* di server (migrasi day_off, repo web). Tabel hanya dibaca.

import { isMissingSchema } from "./backup";
import { supabase } from "./supabase";

export type DayOffKind = "jatah" | "pengganti";
export type DayOffStatus = "diajukan" | "disetujui" | "ditolak" | "dibatalkan" | "dipindah" | "masuk";
export type SwapStatus = "menunggu_rekan" | "menunggu_atasan" | "disetujui" | "ditolak" | "dibatalkan";

export const DAY_OFF_STATUS_LABEL: Record<DayOffStatus, string> = {
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  dipindah: "Dipindah",
  masuk: "Masuk kerja",
};

export const SWAP_STATUS_LABEL: Record<SwapStatus, string> = {
  menunggu_rekan: "Menunggu rekan",
  menunggu_atasan: "Menunggu atasan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};

export const DAY_OFF_NOTE_MAX = 200;

export type DayOffQuota = {
  periodStart: string;
  periodEnd: string;
  quota: number;
  used: number;
  pending: number;
  available: number;
  /** Saldo off pengganti (dari masuk kerja di hari libur). */
  credits: number;
  nextCreditExpiry: string | null;
};

export type DayOff = {
  id: string;
  employeeId: string;
  /** Nama karyawan (untuk daftar persetujuan SPV / Office); null bila tidak terbaca. */
  employeeName: string | null;
  nik: string | null;
  offDate: string;
  kind: DayOffKind;
  status: DayOffStatus;
  replacesId: string | null;
  note: string | null;
  decisionNote: string | null;
  requestedAt: string;
};

export type Swap = {
  id: string;
  status: SwapStatus;
  note: string | null;
  requestedAt: string;
  requesterId: string;
  requesterName: string | null;
  requesterOffId: string;
  requesterOffDate: string | null;
  partnerId: string;
  partnerName: string | null;
  partnerOffId: string;
  partnerOffDate: string | null;
};

export type SwapOption = { offId: string; offDate: string; employeeId: string; name: string | null; nik: string | null };

/** Pesan error fungsi day_off_* sudah berbahasa Indonesia. */
export function friendlyDayOffError(error: { code?: string; message: string }): string {
  if (error.code === "P0001" || error.code === "42501" || error.code === "23505") {
    return error.code === "23505" ? "Sudah ada pengajuan libur di tanggal itu." : error.message;
  }
  if (isMissingSchema(error)) return "Fitur libur belum aktif di server (migrasi database belum dijalankan). Hubungi admin.";
  if (/network|fetch|timeout/i.test(error.message)) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
  return "Terjadi kesalahan. Coba lagi.";
}

const one = <T>(data: T | T[] | null): T | null => (Array.isArray(data) ? (data[0] ?? null) : data);

export async function fetchDayOffQuota(): Promise<DayOffQuota> {
  const { data, error } = await supabase.rpc("day_off_quota");
  if (error) throw error;
  const r = one(data as Record<string, unknown> | Record<string, unknown>[] | null) as Record<string, unknown> | null;
  if (!r) throw { code: "P0001", message: "Data jatah libur tidak ditemukan. Hubungi admin." };
  return {
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    quota: Number(r.quota ?? 0),
    used: Number(r.used ?? 0),
    pending: Number(r.pending ?? 0),
    available: Number(r.available ?? 0),
    credits: Number(r.credits ?? 0),
    nextCreditExpiry: (r.next_credit_expiry as string | null) ?? null,
  };
}

type DayOffRow = {
  id: string;
  employee_id: string;
  off_date: string;
  kind: DayOffKind;
  status: DayOffStatus;
  replaces_id: string | null;
  note: string | null;
  decision_note: string | null;
  requested_at: string;
  employee?: { full_name: string; nik: string } | null;
};

const DAY_OFF_COLUMNS = "id, employee_id, off_date, kind, status, replaces_id, note, decision_note, requested_at";

function mapDayOff(r: DayOffRow): DayOff {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee?.full_name ?? null,
    nik: r.employee?.nik ?? null,
    offDate: r.off_date,
    kind: r.kind,
    status: r.status,
    replacesId: r.replaces_id,
    note: r.note,
    decisionNote: r.decision_note,
    requestedAt: r.requested_at,
  };
}

/** Libur milik sendiri (terbaru di atas). */
export async function fetchMyDaysOff(employeeId: string): Promise<DayOff[]> {
  const { data, error } = await supabase
    .from("day_off")
    .select(DAY_OFF_COLUMNS)
    .eq("employee_id", employeeId)
    .order("off_date", { ascending: false })
    .limit(60);
  if (error) throw error;
  return ((data ?? []) as DayOffRow[]).map(mapDayOff);
}

/** Libur yang menunggu persetujuan (SPV / Office): pengajuan karyawan yang bisa dikelola, selain diri sendiri. */
export async function fetchPendingDaysOff(myEmployeeId: string | null): Promise<DayOff[]> {
  let q = supabase
    .from("day_off")
    .select(`${DAY_OFF_COLUMNS}, employee:employee_id(full_name, nik)`)
    .eq("status", "diajukan")
    .order("off_date", { ascending: true });
  if (myEmployeeId) q = q.neq("employee_id", myEmployeeId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as DayOffRow[]).map(mapDayOff);
}

/** Libur rekan satu cabang yang sudah disetujui & belum lewat (pilihan tukar off). */
export async function fetchSwapOptions(myEmployeeId: string, today: string): Promise<SwapOption[]> {
  const rpc = await supabase.rpc("day_off_swap_options");
  if (!rpc.error) {
    return ((rpc.data ?? []) as Record<string, unknown>[]).map((r) => ({
      offId: r.off_id as string,
      offDate: r.off_date as string,
      employeeId: r.employee_id as string,
      name: (r.full_name as string | null) ?? null,
      nik: (r.nik as string | null) ?? null,
    }));
  }
  if (!isMissingSchema(rpc.error)) throw rpc.error;
  // Fungsi bernama belum ada: baca libur rekan yang disetujui (nama rekan tidak terbaca oleh karyawan).
  const { data, error } = await supabase
    .from("day_off")
    .select("id, employee_id, off_date")
    .eq("status", "disetujui")
    .neq("employee_id", myEmployeeId)
    .gt("off_date", today)
    .order("off_date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { id: string; employee_id: string; off_date: string }[]).map((r) => ({
    offId: r.id,
    offDate: r.off_date,
    employeeId: r.employee_id,
    name: null,
    nik: null,
  }));
}

type SwapRow = {
  id: string;
  status: SwapStatus;
  note: string | null;
  requested_at: string;
  requester_id: string;
  partner_id: string;
  requester_off_id: string;
  partner_off_id: string;
  requester_name?: string | null;
  partner_name?: string | null;
  requester_off_date?: string | null;
  partner_off_date?: string | null;
};

/** Tukar off yang melibatkan saya (atau yang perlu saya setujui sebagai atasan). */
export async function fetchSwaps(): Promise<Swap[]> {
  const rpc = await supabase.rpc("my_day_off_swaps");
  let rows: SwapRow[];
  if (!rpc.error) {
    rows = (rpc.data ?? []) as SwapRow[];
  } else {
    if (!isMissingSchema(rpc.error)) throw rpc.error;
    const { data, error } = await supabase
      .from("day_off_swap")
      .select("id, status, note, requested_at, requester_id, partner_id, requester_off_id, partner_off_id")
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    rows = (data ?? []) as SwapRow[];
  }
  // Tanggal libur kedua pihak (fungsi bernama sudah mengisinya; cara cadangan membaca tabel day_off).
  const missing = rows.filter((r) => !r.requester_off_date || !r.partner_off_date);
  if (missing.length > 0) {
    const ids = [...new Set(missing.flatMap((r) => [r.requester_off_id, r.partner_off_id]))];
    const { data } = await supabase.from("day_off").select("id, off_date").in("id", ids);
    const dates = new Map(((data ?? []) as { id: string; off_date: string }[]).map((d) => [d.id, d.off_date]));
    for (const r of missing) {
      r.requester_off_date ??= dates.get(r.requester_off_id) ?? null;
      r.partner_off_date ??= dates.get(r.partner_off_id) ?? null;
    }
  }
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    note: r.note,
    requestedAt: r.requested_at,
    requesterId: r.requester_id,
    requesterName: r.requester_name ?? null,
    requesterOffId: r.requester_off_id,
    requesterOffDate: r.requester_off_date ?? null,
    partnerId: r.partner_id,
    partnerName: r.partner_name ?? null,
    partnerOffId: r.partner_off_id,
    partnerOffDate: r.partner_off_date ?? null,
  }));
}

async function call(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.rpc(fn, args);
  return error ? friendlyDayOffError(error) : null;
}

/** Ajukan libur (jatah / off pengganti), atau pindahkan libur yang sudah disetujui (`replaces`). */
export const requestDayOff = (date: string, kind: DayOffKind, note: string, replaces?: string) =>
  call("day_off_request", { p_date: date, p_kind: kind, p_note: note.trim() || null, p_replaces: replaces ?? null });
export const cancelDayOff = (id: string) => call("day_off_cancel", { p_id: id });
export const decideDayOff = (id: string, approve: boolean, note?: string) =>
  call("day_off_decide", { p_id: id, p_approve: approve, p_note: note?.trim() || null });
export const requestSwap = (myOff: string, partnerOff: string, note: string) =>
  call("day_off_swap_request", { p_my_off: myOff, p_partner_off: partnerOff, p_note: note.trim() || null });
export const respondSwap = (id: string, accept: boolean) => call("day_off_swap_respond", { p_id: id, p_accept: accept });
export const cancelSwap = (id: string) => call("day_off_swap_cancel", { p_id: id });
export const decideSwap = (id: string, approve: boolean) => call("day_off_swap_decide", { p_id: id, p_approve: approve });

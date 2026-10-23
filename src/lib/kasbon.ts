// Kasbon (pinjaman gaji): plafon dihitung dari gaji harian × hari masuk kerja (HK) di periode gajian.
// SEMUA hitungan uang dilakukan di server (fungsi kasbon_quota / kasbon_request di migrasi kasbon,
// repo web). App hanya menampilkan dan mengirim pengajuan.

import { isMissingSchema } from "./backup";
import { supabase } from "./supabase";

export type KasbonStatus = "diajukan" | "disetujui" | "ditolak" | "dicairkan" | "lunas" | "dibatalkan";

export const KASBON_STATUS_LABEL: Record<KasbonStatus, string> = {
  diajukan: "Diajukan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dicairkan: "Dicairkan",
  lunas: "Lunas",
  dibatalkan: "Dibatalkan",
};

export const KASBON_NOTE_MAX = 200;
const PROOF_BUCKET = "kasbon-proof";

export type KasbonQuota = {
  periodStart: string;
  periodEnd: string;
  baseSalary: number | null;
  /** 'karyawan' = gaji khusus orang ini, 'jabatan' = gaji jabatan, null = gaji belum diatur admin. */
  salarySource: "karyawan" | "jabatan" | null;
  dailyDivisor: number;
  dailyRate: number;
  hk: number;
  plafon: number;
  used: number;
  available: number;
};

export type Kasbon = {
  id: string;
  amount: number;
  note: string | null;
  status: KasbonStatus;
  periodStart: string;
  periodEnd: string;
  hk: number;
  plafon: number;
  requestedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  disbursedAt: string | null;
  proofPhoto: string | null;
  settledAt: string | null;
};

type QuotaRow = {
  period_start: string;
  period_end: string;
  base_salary: number | string | null;
  salary_source: "karyawan" | "jabatan" | null;
  daily_divisor: number;
  daily_rate: number | string | null;
  hk: number;
  plafon: number | string | null;
  used: number | string | null;
  available: number | string | null;
};

type KasbonRow = {
  id: string;
  amount: number | string;
  note: string | null;
  status: KasbonStatus;
  period_start: string;
  period_end: string;
  hk: number;
  plafon: number | string;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  disbursed_at: string | null;
  proof_photo: string | null;
  settled_at: string | null;
};

// Kolom numeric bisa datang sebagai angka atau teks dari server.
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));

/** "Rp769.230" (rupiah tanpa desimal, pemisah ribuan titik). */
export function formatRupiah(value: number): string {
  return `Rp${Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export function friendlyKasbonError(error: { code?: string; message: string }): string {
  // Pesan dari fungsi kasbon_* sudah berbahasa Indonesia dan aman ditampilkan.
  if (error.code === "P0001" || error.code === "42501") return error.message;
  if (isMissingSchema(error)) return "Fitur kasbon belum aktif di server (migrasi database belum dijalankan). Hubungi admin.";
  if (/network|fetch|timeout/i.test(error.message)) return "Tidak bisa terhubung ke server. Periksa koneksi internet.";
  return "Terjadi kesalahan. Coba lagi.";
}

/** Plafon kasbon akun ini untuk periode gajian berjalan. */
export async function fetchQuota(): Promise<KasbonQuota> {
  const { data, error } = await supabase.rpc("kasbon_quota");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as QuotaRow | undefined;
  if (!row) throw { code: "P0001", message: "Data plafon kasbon tidak ditemukan. Hubungi admin." };
  return {
    periodStart: row.period_start,
    periodEnd: row.period_end,
    baseSalary: row.salary_source ? num(row.base_salary) : null,
    salarySource: row.salary_source,
    dailyDivisor: row.daily_divisor,
    dailyRate: num(row.daily_rate),
    hk: row.hk,
    plafon: num(row.plafon),
    used: num(row.used),
    available: num(row.available),
  };
}

/** Riwayat kasbon milik akun ini (RLS: hanya baris sendiri), terbaru di atas. */
export async function fetchHistory(): Promise<Kasbon[]> {
  const { data, error } = await supabase
    .from("kasbon")
    .select(
      "id, amount, note, status, period_start, period_end, hk, plafon, requested_at, decided_at, decision_note, disbursed_at, proof_photo, settled_at",
    )
    .order("requested_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as KasbonRow[]).map((r) => ({
    id: r.id,
    amount: num(r.amount),
    note: r.note,
    status: r.status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    hk: r.hk,
    plafon: num(r.plafon),
    requestedAt: r.requested_at,
    decidedAt: r.decided_at,
    decisionNote: r.decision_note,
    disbursedAt: r.disbursed_at,
    proofPhoto: r.proof_photo,
    settledAt: r.settled_at,
  }));
}

export async function requestKasbon(amount: number, note: string): Promise<string | null> {
  const { error } = await supabase.rpc("kasbon_request", { p_amount: amount, p_note: note.trim() || null });
  return error ? friendlyKasbonError(error) : null;
}

export async function cancelKasbon(id: string): Promise<string | null> {
  const { error } = await supabase.rpc("kasbon_cancel", { p_id: id });
  return error ? friendlyKasbonError(error) : null;
}

/** Link sementara (1 jam) untuk melihat foto bukti pencairan. */
export async function proofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

/** Status yang ditampilkan: kasbon dicairkan yang periodenya sudah lewat = lunas lewat potong gaji. */
export function displayStatus(k: Kasbon, today: string): { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" } {
  if (k.status === "dicairkan" && k.periodEnd < today) return { label: "Lunas · potong gaji", tone: "success" };
  switch (k.status) {
    case "diajukan":
      return { label: KASBON_STATUS_LABEL.diajukan, tone: "warning" };
    case "disetujui":
      return { label: KASBON_STATUS_LABEL.disetujui, tone: "info" };
    case "dicairkan":
      return { label: KASBON_STATUS_LABEL.dicairkan, tone: "info" };
    case "lunas":
      return { label: KASBON_STATUS_LABEL.lunas, tone: "success" };
    case "ditolak":
      return { label: KASBON_STATUS_LABEL.ditolak, tone: "danger" };
    case "dibatalkan":
      return { label: KASBON_STATUS_LABEL.dibatalkan, tone: "muted" };
  }
}

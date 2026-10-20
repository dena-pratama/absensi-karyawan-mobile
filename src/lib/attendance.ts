// Data absensi karyawan: kirim check-in/out (GPS + selfie) dan baca riwayat.
// Aturan absen (radius cabang, jam server, tolak fake GPS) dijaga fungsi attendance_check
// di database — lihat migrasi attendance_check_in_out di repo web.

import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

import { todayWIB } from "@/shared/format";
import type { AttendanceStatus } from "@/shared/labels";
import type { GpsFix } from "./location";
import { supabase } from "./supabase";

export type CheckKind = "in" | "out";

export const SELFIE_BUCKET = "attendance-selfie";

export type AttendanceRow = {
  id: number;
  attendance_date: string;
  status: AttendanceStatus;
  note: string | null;
  check_in_at: string | null;
  check_in_distance_m: number | null;
  check_out_at: string | null;
  check_out_distance_m: number | null;
  branch: { code: string; name: string } | null;
};

export const ATTENDANCE_COLUMNS =
  "id, attendance_date, status, note, check_in_at, check_in_distance_m, check_out_at, check_out_distance_m, branch:branch_id(code, name)";

function friendlyError(error: { code?: string; message: string }): string {
  // Pesan dari fungsi attendance_check sudah berbahasa Indonesia.
  if (error.code === "P0001" || error.code === "42501") return error.message;
  if (/network|fetch|timeout/i.test(error.message)) {
    return "Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.";
  }
  if (error.code === "PGRST202") {
    return "Fitur absen belum aktif di server (migrasi database belum dijalankan). Hubungi admin.";
  }
  return "Absen gagal dikirim. Coba lagi.";
}

/** Kecilkan foto selfie (lebar 720 px, JPEG) supaya hemat kuota & cepat terunggah. */
async function compressSelfie(uri: string): Promise<ArrayBuffer> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 720 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  if (Platform.OS === "web") return (await fetch(saved.uri)).arrayBuffer();
  return new File(saved.uri).arrayBuffer();
}

export async function submitAttendance(
  kind: CheckKind,
  employeeId: string,
  fix: GpsFix,
  photoUri: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const body = await compressSelfie(photoUri);
    const path = `${employeeId}/${todayWIB()}_${kind}_${Date.now()}.jpg`;
    const upload = await supabase.storage
      .from(SELFIE_BUCKET)
      .upload(path, body, { contentType: "image/jpeg", upsert: false });
    if (upload.error) {
      return {
        ok: false,
        message: /bucket not found/i.test(upload.error.message)
          ? "Penyimpanan foto belum disiapkan di server (migrasi database belum dijalankan). Hubungi admin."
          : friendlyError(upload.error),
      };
    }

    const { error } = await supabase.rpc("attendance_check", {
      p_kind: kind,
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy_m: fix.accuracy,
      p_photo: path,
      p_mocked: fix.mocked,
    });
    if (error) return { ok: false, message: friendlyError(error) };
    return { ok: true };
  } catch {
    return { ok: false, message: "Absen gagal dikirim. Periksa koneksi internet lalu coba lagi." };
  }
}

/** Riwayat absensi satu bulan (month: 1–12), terbaru di atas. */
export async function fetchMonth(employeeId: string, year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const { data, error } = await supabase
    .from("attendance_daily")
    .select(ATTENDANCE_COLUMNS)
    .eq("employee_id", employeeId)
    .gte("attendance_date", `${year}-${pad(month)}-01`)
    .lte("attendance_date", `${year}-${pad(month)}-${pad(last)}`)
    .order("attendance_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRow[];
}

/** Lama kerja (menit) dari jam masuk–pulang; null kalau belum lengkap. */
export function workedMinutes(row: Pick<AttendanceRow, "check_in_at" | "check_out_at">): number | null {
  if (!row.check_in_at || !row.check_out_at) return null;
  return Math.max(0, Math.round((Date.parse(row.check_out_at) - Date.parse(row.check_in_at)) / 60000));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} jam ${m} mnt` : `${m} mnt`;
}

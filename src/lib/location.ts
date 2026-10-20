// Ambil posisi GPS sekali (hanya saat layar absen dibuka / tombol ditekan — tanpa pelacakan latar belakang).

import * as Location from "expo-location";

import type { LatLng } from "@/shared/geo";

export type GpsFix = LatLng & {
  /** Radius ketidakpastian (meter); null kalau tidak diketahui. */
  accuracy: number | null;
  /** true = lokasi dari aplikasi fake GPS / simulator. */
  mocked: boolean;
};

export type GpsState =
  | { status: "locating" }
  | { status: "ok"; fix: GpsFix }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "off" }
  | { status: "error"; message: string };

const TIMEOUT_MS = 20_000;

export async function locate(): Promise<GpsState> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { status: "denied", canAskAgain: perm.canAskAgain };
    if (!(await Location.hasServicesEnabledAsync())) return { status: "off" };

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    if (!pos) return { status: "error", message: "Sinyal GPS belum didapat. Coba di tempat terbuka lalu perbarui." };

    return {
      status: "ok",
      fix: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        mocked: pos.mocked === true,
      },
    };
  } catch {
    return { status: "error", message: "Gagal membaca lokasi. Coba perbarui lagi." };
  }
}

/** Jarak dua titik dalam meter (haversine) — rumus yang sama dengan fungsi attendance_check di database. */
export function distanceM(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

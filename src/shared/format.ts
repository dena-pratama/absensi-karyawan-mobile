// Salinan sebagian dari repo web: absensi-karyawan/src/lib/format.ts — ubah di sana dulu, lalu salin ke sini.
// Tanggal absensi selalu WIB (sama dengan fungsi today_wib() di database).

const TZ = "Asia/Jakarta";

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD. */
export function todayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** "08:15 WIB" */
export function formatTimeWIB(iso: string): string {
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return `${time.replace(".", ":")} WIB`;
}

/** "Selasa, 20 Okt 2026" dari YYYY-MM-DD */
export function formatDateLong(ymd: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${ymd}T00:00:00Z`));
}

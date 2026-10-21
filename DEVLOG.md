# DEVLOG — Absensi Ekspedisi Mobile

Catatan aktivitas penting. Entri terbaru di atas.

## 2026-10-21 — Login dengan username (sama dengan panel web)

- `src/shared/login-id.ts` disalin dari repo web (`src/lib/login-id.ts`). Username "budi01" diubah jadi
  email internal `budi01@akun.denaprojects.web.id` sebelum login (Supabase hanya mengenal email).
  **Domain harus sama persis dengan web**; kalau berubah, akun lama tidak bisa login.
- Layar login: kolom **Username / Email** (keyboard teks biasa, tanpa huruf besar otomatis / koreksi),
  kata sandi minimal 6 karakter (`PASSWORD_MIN`). Format username tidak valid atau sandi < 6 karakter
  langsung ditolak dengan "Username / email atau kata sandi salah.", tanpa memanggil server.
  Admin tetap bisa login dengan email asli.
- Profil & layar SPV menampilkan username (`displayLogin`), bukan email internal.
- Dicek di pratinjau web: kolom & pesan error baru tampil. Butuh build EAS baru supaya APK ikut berubah.

## 2026-10-21 — Build preview Android (APK untuk dibagikan)

- Build `preview` `0982e7b4-f8c0-4301-bd26-9a0aeac810bf` **berhasil**. APK mode rilis, tersambung ke database Supabase asli.
- Ukuran **±126 MB** (development build ±267 MB). Masih besar karena satu APK berisi 4 jenis prosesor
  (arm64-v8a, armeabi-v7a, x86, x86_64); HP Android biasa hanya butuh arm64-v8a / armeabi-v7a.
- Lalu dipasang `expo-build-properties` dengan `android.buildArchs: ["arm64-v8a", "armeabi-v7a"]`:
  x86/x86_64 (emulator) dibuang. Efek samping: build baru tidak bisa dipasang di emulator x86.
  Build preview ulang `57ec32ad-12ce-4af4-a7fa-dbac840927c6`: **±64 MB** (turun dari ±126 MB).
- `npx expo install` kembali membuang `@emnapi/*` dari lock file → diperbaiki lagi dengan
  `npx npm@10 install --package-lock-only` (langkah ini kini dicatat di README).

## 2026-10-21 — EAS siap + development build Android pertama

- `eas init` di akun **denapratama**: proyek baru `@denapratama/absensi-karyawan-mobile`
  (projectId di `app.json` → `extra.eas.projectId`, `owner`). `eas init` juga menambah daftar izin Android
  (kamera, lokasi) ke `app.json`.
- `eas.json`:
  - `development`: development build (`expo-dev-client`), APK, dibagikan internal;
  - `preview`: APK biasa untuk dicoba tim;
  - `production`: untuk Play Store, nomor versi naik otomatis (versi disimpan di EAS).
- Variabel `EXPO_PUBLIC_SUPABASE_URL` (plaintext) & `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sensitive)
  diisi di EAS untuk environment development, preview, production. `.env.local` tidak ikut terunggah ke EAS.
- Keystore Android dibuat & disimpan di server Expo.
- Build development Android pertama (`39d6a6a3…`) **gagal** di `npm ci`: `package-lock.json` dari npm 11
  di Windows tidak memuat `@emnapi/core` & `@emnapi/runtime` (peer opsional). Lock dibuat ulang dengan
  `npx npm@10 install --package-lock-only`, dicek dengan `npm ci --dry-run` (npm 10 & 11).
  **Kalau build EAS gagal lagi dengan "Missing … from lock file", ulangi cara ini.**
- Build kedua `93469e5d-9cf6-4d9a-b03c-061b899fe50c` **berhasil** (APK development).

## 2026-10-21 — Pasang expo-dev-client

- `expo-dev-client` dipasang (`npx expo install`) sebagai persiapan **development build**: app versi
  pengembangan buatan sendiri (dibuat lewat EAS Build), dengan ikon & nama app sendiri.
- `npm start` tetap mode **Expo Go** (`expo start --go`). `npm run start:dev` untuk development build.
- Belum ada: `eas.json` & `projectId` EAS (perlu `npx eas-cli@latest login` oleh user, lalu `eas init`).

## 2026-10-21 — Tab Check In, Check Out, Riwayat, Profil (GPS + selfie)

**Database** (repo web, `supabase/migrations/20261021020000_attendance_check_in_out.sql`).
**Wajib dijalankan dulu** di Supabase SQL Editor, tanpa itu tombol kirim absen akan gagal:
- kolom jam / lokasi / jarak / foto untuk check-in & check-out di `attendance_daily`;
- bucket foto privat `attendance-selfie`;
- fungsi `attendance_check`: jam dari server, radius cabang dicek di server, fake GPS ditolak.

**App**
- Paket baru: `expo-location`, `expo-camera`, `expo-image-manipulator`, `expo-file-system` (semuanya ada di Expo Go).
  Izin hanya lokasi saat app dibuka (tanpa latar belakang) dan kamera (tanpa mikrofon).
- Karyawan → 4 tab (`src/app/(tabs)/`):
  - **Check In / Check Out**: sapaan + jam WIB berjalan, kartu **Lokasi GPS** (jarak ke titik cabang, akurasi,
    status dalam/luar area, deteksi lokasi palsu), kartu **Foto Selfie** (kamera depan, foto dikecilkan
    ke 720 px sebelum diunggah), tombol kirim aktif hanya jika lokasi OK + foto ada.
    Check Out hanya bisa setelah Check In. Status Sakit/Tidak Hadir dari SPV ditampilkan.
  - **Riwayat**: pilih bulan, statistik (hadir, sakit, tidak hadir, jam kerja), daftar harian jam masuk/pulang + durasi.
  - **Profil**: nama, NIK, jabatan, cabang, status kerja, tanggal bergabung, area absen, tombol Keluar.
- SPV → layar sementara `spv.tsx` (absen GPS khusus karyawan; fitur pantau cabang belum dibuat).
- Kode: `src/lib/{employee,attendance,location}.ts(x)`, `src/components/{kit,Icon}.tsx`, `src/components/attendance/`.

**Dari desain yang sengaja tidak dipakai**: peta (butuh API key Google), "AI Biometrik / deteksi helm & APD",
"On Schedule / Tepat Waktu / Toleransi" (aturan telat belum diputuskan), libur & sisa kuota, unduh PDF / Excel,
pengaturan notifikasi / auto GPS logging / ganti PIN / hotline, foto profil (belum ada di database).

**Batasan sekarang**: Check Out harus di tanggal WIB yang sama dengan Check In (shift lewat tengah malam belum didukung).

## 2026-10-21 — Ikon app disamakan dengan web

- Ikon app memakai logo web (`absensi-karyawan/src/app/icon.svg`): simbol jaringan cyan `#00d2ff`
  di atas `#18202e`. Dibuat ulang: `icon.png` (1024), ikon adaptif Android (latar, depan, monokrom),
  `splash-icon.png`, `favicon.png`.
- iOS kini memakai `icon.png` biasa (folder `assets/expo.icon` bawaan template dihapus).
- Logo truk di layar login juga diganti dengan simbol logo yang sama.
- Catatan: di **Expo Go** yang tampil tetap ikon Expo Go. Ikon baru terlihat setelah app dibuild
  (development build / EAS Build).

## 2026-10-21 — Desain baru layar login

- Layar login (`src/app/login.tsx`) dibuat ulang mengikuti desain Stitch
  `mobile_login_absensi_ekspedisi`: logo truk dengan titik cyan menyala, kartu login gelap,
  kolom berikon, tombol tampil/sembunyikan kata sandi, tombol "Login →" bercahaya.
- Font **Inter** (`@expo-google-fonts/inter`), ikon Material Symbols lewat `expo-symbols`
  (iOS memakai SF Symbols). Warna desain disimpan di `loginColors` (`src/lib/theme.ts`).
- Bagian desain yang **sengaja tidak dipakai** (bertentangan dengan aturan yang sudah ada / belum diputuskan):
  - Login pakai **NIK / PIN** → tetap **email + kata sandi** (akun login Supabase memakai email).
  - **Lupa PIN?** → tidak ada; reset sandi lewat admin.
  - **Pilihan Hub/Cabang + "Dalam Radius 100m"** dan **"GPS Ready"** → cabang sudah ditentukan dari
    penempatan karyawan, dan aturan GPS belum diputuskan.
  - **"Ingat Akun di Handphone ini"** → sesi selalu diingat sampai menekan Keluar.

## 2026-10-21 — Supabase + login + arah layar sesuai role

**Yang ditambahkan**
- Paket: `@supabase/supabase-js`, `expo-secure-store`, `@react-native-async-storage/async-storage`,
  `expo-crypto`, `aes-js` (semua dipasang dengan `npx expo install`, semuanya jalan di Expo Go).
- `src/lib/supabase.ts` — koneksi ke Supabase (database yang sama dengan web). Membaca
  `EXPO_PUBLIC_SUPABASE_URL` & `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari `.env.local`.
  Kalau belum diisi, app menampilkan layar **"Konfigurasi belum lengkap"** (tidak crash).
- Sesi login disimpan aman di HP: isi sesi dienkripsi (AES-256) di AsyncStorage, kunci
  enkripsinya di SecureStore (Keystore/Keychain) — pola *LargeSecureStore* dari panduan Supabase.
  Token diperpanjang otomatis hanya saat app sedang dibuka.
- `src/lib/auth.tsx` — context sesi + role. Role dibaca lewat `rpc("current_app_role")`.
- Layar (`src/app/`):
  - `login.tsx` — email + kata sandi, pesan error ramah. Tanpa daftar akun / lupa sandi.
  - `index.tsx` — layar utama sementara untuk **karyawan & SPV**: nama/NIK atau cabang, role, tombol Keluar.
  - `admin.tsx` — akun **admin** diarahkan memakai panel web.
  - `tanpa-akses.tsx` — akun tanpa role: "Akun belum diberi akses, hubungi admin"
    (juga dipakai kalau role gagal dibaca karena koneksi, dengan tombol Coba lagi).
  - `_layout.tsx` — mengatur layar mana yang boleh dibuka (`Stack.Protected`) sesuai login & role.
- Tema gelap seperti web (`src/lib/theme.ts`), komponen dasar di `src/components/ui.tsx`.

**Cara mencoba**
1. Salin `.env.example` → `.env.local`, isi URL & publishable key (Supabase Dashboard → Project Settings → API Keys).
2. `npx expo start`, scan QR dengan Expo Go, login dengan akun yang dibuat admin di web.

**Belum dibangun (menunggu keputusan aturan absen)**: absen masuk/pulang, GPS, selfie, riwayat, profil.

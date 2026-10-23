# DEVLOG — Absensi Ekspedisi Mobile

Catatan aktivitas penting. Entri terbaru di atas.

## 2026-10-25 — Ceklis Absensi dihapus dari app SPV

- Keputusan user: Ceklis Absensi tidak dipakai di app (tidak bisa diisi SPV). Ceklis & monitoring cabang
  hanya lewat panel web.
- Tab SPV kini: **Absen · Riwayat · Kasbon · Backup · Profil**. Absen jadi layar pertama (`spv/index.tsx`).
- Kode ceklis dihapus: `fetchDayRoster`, `saveChecklist`, pemilih cabang `BranchChips`, pilihan cabang di
  `SpvProvider`. Daftar cabang SPV tetap dipakai pemilih outlet absen & tab Backup.
- Build EAS dari commit `00e4261`, keduanya **berhasil**:
  - development `ba9af831-04ba-4820-b826-1609a9e52019`: ±142 MB;
  - preview `0b118857-fc23-4214-a8de-041226c8f97d`: ±64 MB.

## 2026-10-25 — Update paket Expo + build EAS (SPV absen, kasbon, mode terang)

- `npx expo install --fix`: 8 paket SDK 58 naik ke versi patch terbaru (expo, expo-router, expo-camera,
  expo-splash-screen, expo-status-bar, expo-linking, @expo/ui, dll.). `expo-status-bar` masuk daftar plugin.
  Lock file dibuat ulang dengan npm 10. `expo-doctor` 20/20.
- Dari commit `693e5e1`, kedua build **berhasil**:
  - development `e783203d-f726-43d2-9c3e-1b0875442619`: ±142 MB;
  - preview `734ec869-ada8-484f-9516-496ac6cc00c7`: ±64 MB.

## 2026-10-25 — Mode terang (light mode)

- Pilihan **Tampilan** di Profil (karyawan & SPV): Otomatis (ikut tema HP) / Terang / Gelap. Pilihan
  disimpan di HP (AsyncStorage `theme-mode`). `app.json` → `userInterfaceStyle: "automatic"`, jadi berlaku
  di build EAS baru; Expo Go mengikuti tema HP.
- `src/lib/theme.tsx` (menggantikan `theme.ts`): palet gelap (seperti panel web) & terang. Di mode terang,
  brand cyan dipakai lebih gelap (`#0891b2`) supaya teks tetap terbaca di latar putih.
- Cara kerja: `colors` / `appColors` dan gaya dari `themedStyles(() => ({...}))` (pengganti
  `StyleSheet.create`) selalu membaca tema aktif. Saat tema berganti, `ThemeProvider` memuat ulang tampilan
  (key = tema). Sesi login tetap, tapi tab kembali ke tab awal dan data layar dimuat ulang.
  **Komponen baru: pakai `themedStyles` dan jangan simpan warna di konstanta tingkat modul.**
- Warna yang tadinya ditulis langsung (bayangan, cahaya tombol, garis kartu, latar info) dipindah ke palet.
  Status bar ikut tema.
- Dicek di pratinjau web: layar login di mode terang & gelap, termasuk berganti saat app terbuka.

## 2026-10-25 — Kasbon (pinjaman gaji)

Pasangan migrasi web `20261025000000_kasbon.sql`, yang belum dijalankan saat ditulis. Sebelum migrasi,
tab Kasbon menampilkan "Fitur kasbon belum aktif di server".

**Aturan (keputusan user):**
- plafon = gaji pokok (jabatan, atau khusus per orang) ÷ pembagi (diatur admin) × HK. HK = hari berstatus
  Hadir di periode gajian (cut-off diatur admin);
- kasbon diajukan / disetujui / dicairkan di periode itu mengurangi sisa plafon;
- pelunasan lewat potong gaji.

**Semua hitungan uang di server** (`kasbon_quota`, `kasbon_request`). App hanya menampilkan.

**Tab Kasbon** untuk karyawan & SPV (`src/components/KasbonScreen.tsx`, data di `src/lib/kasbon.ts`):
- kartu plafon: periode, gaji pokok, gaji harian (÷ pembagi), HK, plafon, sudah dipakai, sisa;
- form ajukan: nominal rupiah dengan pemisah titik, tombol cepat 25% / 50% / Maksimal, keperluan
  (maks. 200 huruf). Server mengecek ulang batas plafon;
- riwayat: nominal, status (Diajukan, Disetujui, Ditolak, Dicairkan, Lunas, Dibatalkan; dicairkan yang
  periodenya sudah lewat tampil "Lunas · potong gaji"), catatan admin, tanggal tiap tahap;
- **Batalkan** selama masih Diajukan;
- **Lihat bukti**: foto pencairan dari bucket privat `kasbon-proof`, lewat link sementara 1 jam.

Gaji pokok belum diatur → pesan "Gaji pokok belum diatur", form tidak ditampilkan.
Akun belum terhubung ke data karyawan → pesan dari server. Admin memakai panel web, jadi app admin tidak berubah.

## 2026-10-24 — SPV ikut absen (pilih outlet)

Keputusan user berubah: SPV sekarang **ikut absen** lewat app (GPS + selfie) dan memilih outlet. Pasangan
migrasi web `20261024000000_spv_attendance.sql`, yang belum dijalankan saat ditulis.
- Admin menghubungkan akun SPV ke data karyawannya di web (Pengguna & Akses → "Absen sebagai").
  Belum terhubung → tab Absen menampilkan "Akun SPV belum terhubung ke data karyawan, hubungi admin"
  tanpa tombol absen.
- Tab SPV kini: **Ceklis · Absen · Riwayat · Backup · Profil**.
  - **Absen** (`CheckScreen` dengan `outlets`): satu layar, check in dulu lalu check out.
  - **Pemilih outlet**: cabang-cabang SPV, ditambah penempatan & backup data karyawannya, diurutkan dari yang
    terdekat, dengan jarak dan status dalam/luar area. Outlet terdekat terpilih otomatis dan bisa diganti.
  - Outlet terpilih dikirim sebagai `p_branch` ke `attendance_check`.
  - Check out boleh di outlet lain. Kalau baris hari ini sudah diisi ceklis, check in mengikuti cabang baris itu.
- Riwayat (`src/components/HistoryScreen.tsx`, dipakai karyawan & SPV) menampilkan outlet check out kalau
  berbeda dari outlet check in. Kolom `check_out_branch_id` dibaca dengan cadangan: kalau kolomnya belum ada
  (migrasi belum dijalankan), query diulang tanpa kolom itu.
- Karyawan: tidak berubah (tanpa `p_branch`, server memilih cabang terdekat yang diizinkan).
- Teks UI tidak memakai tanda pisah panjang (preferensi user). "—" di Riwayat diganti "Belum".

## 2026-10-22 — Fix keamanan: daftar cabang lewat backup_branch_options()

Pasangan migrasi web `20261022010000_branch_visibility_fix.sql`. Migrasi itu menghapus policy
"semua akun boleh baca semua cabang", jadi karyawan tidak lagi melihat semua cabang.
- Pilihan cabang tujuan backup (SPV) kini dari `supabase.rpc("backup_branch_options")`, bukan tabel `branch`.
  Kalau fungsinya belum ada (migrasi belum dijalankan), app memakai cara lama.
- Cabang di luar milik SPV tidak bisa dibaca lewat join, misalnya tujuan backup dari cabang SPV atau asal
  karyawan backup yang masuk. `fetchBackups` kini selalu memuat `from_branch_id` / `to_branch_id`, lalu
  kode & namanya diisi dari peta hasil `backup_branch_options()`. Sebelumnya backup seperti ini hilang
  dari daftar SPV, karena baris yang `to_branch`-nya kosong dibuang.
- Tempat lain sudah dicek: karyawan hanya membaca cabang penempatan, cabang backup, dan cabang di baris
  absennya sendiri. SPV hanya membaca cabang-cabangnya. Semua masih diizinkan RLS.

## 2026-10-22 — Build EAS: login username + backup / SPV banyak cabang

- Dari commit `521ec0c`, kedua build **berhasil**:
  - development `a74ffc2a-9162-4483-be0e-efedd28db5a3`: ±142 MB (sebelumnya ±267 MB; x86 sudah dibuang);
  - preview `ab47e9b7-4a80-45ba-85da-b29fa7acdef6`: ±64 MB.

## 2026-10-22 — Backup karyawan antar cabang + SPV banyak cabang

Butuh migrasi repo web `supabase/migrations/20261022000000_backup_and_multi_branch_spv.sql`.
Saat ditulis, migrasi itu **belum dijalankan**. Sebelum migrasi dijalankan, app tetap jalan:
backup dianggap kosong, SPV memakai cabang tunggal `app_user.branch_id`.

**Karyawan**
- Penempatan dibaca yang **berlaku hari ini** (`valid_from <= hari ini`, `valid_to` kosong / `>= hari ini`),
  bukan sekadar `valid_to` kosong, karena sekarang ada mutasi terjadwal.
- Backup hari ini (`employee_backup`) → kotak "Hari ini backup di KODE - Nama" di layar Check In/Out.
  Info jarak GPS memakai cabang backup **dan** cabang penempatan, dipilih yang terdekat (sama dengan
  `attendance_check()` di server). Check out memakai cabang baris check in. Validasi akhir tetap di server.
- Profil: kartu "Jadwal Backup" (hari ini & akan datang).

**SPV** (rute `src/app/spv/`, menggantikan layar sementara `spv.tsx`): 3 tab
- **Ceklis**:
  - pemilih cabang (dari `app_user_branch`) dan tanggal (maks. hari ini);
  - roster = karyawan cabang itu + karyawan backup yang masuk ("Backup dari X"). Karyawan cabang itu
    yang sedang backup di cabang lain hanya bisa dilihat ("Sedang backup di Y");
  - tombol Hadir / Sakit / Tidak Hadir per karyawan, lalu Simpan, seperti `saveAttendance` di web.
    Jam check-in/out GPS ditampilkan dan tidak diubah.
- **Backup**:
  - daftar backup aktif & akan datang yang melibatkan cabang SPV;
  - tambah / ubah / hapus: pilih karyawan dari cabang SPV, cabang tujuan (semua cabang), tanggal mulai & selesai
    (default 1 hari, maks. 93 hari), keterangan;
  - pesan error dari trigger database (P0001) ditampilkan apa adanya.
- **Profil**: username, daftar cabang, tombol Keluar. SPV tidak absen sendiri.

Kode baru: `src/lib/backup.ts`, `src/lib/spv.tsx`, `src/components/pickers.tsx` (chip cabang, langkah tanggal,
kolom pilihan dengan pencarian). Dicek: `tsc`, `expo lint`, `expo-doctor`, bundle Android, layar login di
pratinjau web. Layar SPV & backup belum dicoba dengan akun asli. Butuh build EAS baru supaya APK ikut berubah.

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

# DEVLOG — Absensi Ekspedisi Mobile

Catatan aktivitas penting. Entri terbaru di atas.

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

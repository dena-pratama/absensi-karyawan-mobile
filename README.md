# Absensi Ekspedisi — Mobile

Aplikasi Android (dan iOS) untuk karyawan & SPV: absen harian dengan **GPS** (dalam
radius cabang) + **selfie** kamera. Terhubung ke database Supabase yang **sama** dengan
panel web admin ([absensi-karyawan](https://github.com/dena-pratama/absensi-karyawan)).

![Expo](https://img.shields.io/badge/Expo-SDK_58-000020?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.88-61dafb?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/status-awal_pengembangan-amber)

## Hubungan dengan repo web

```
 absensi-karyawan (web, Next.js → Vercel)      absensi-karyawan-mobile (repo ini, Expo)
            │                                                 │
            └────────────►  Supabase (1 database)  ◄─────────┘
                       tabel · RLS per role · akun login · storage foto
```

- **Skema database & RLS hanya diubah di repo web** (`supabase/migrations/`). App ini mengikuti.
- App memakai **publishable key** saja; akses data dibatasi RLS (karyawan hanya data dirinya, SPV hanya cabangnya).
- Akun karyawan / SPV dibuat admin di web: *Pengaturan → Pengguna & Akses*.
- Titik & radius GPS cabang diatur admin di web: *Pengaturan → Manajemen Cabang → Area GPS Absen*.

## Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Framework | Expo SDK 58, React Native 0.88, React 19 |
| Navigasi | Expo Router (file-based, `src/app/`) |
| Bahasa | TypeScript (strict) |
| Backend | Supabase (`@supabase/supabase-js`) — *akan dipasang* |
| Fitur HP | Lokasi (GPS) & kamera — *akan dipasang* |

## Struktur direktori

```
.
├── src/
│   ├── app/              # Layar & layout (Expo Router) — hanya file rute di sini
│   │   ├── _layout.tsx
│   │   └── index.tsx     # Layar sementara
│   └── shared/           # Salinan dari repo web (label status/role, GPS, format tanggal WIB)
├── assets/               # Ikon & splash
├── app.json              # Nama app, package id, plugin
└── .env.example          # Contoh konfigurasi Supabase
```

Rencana berikutnya: `src/lib/` (client Supabase, sesi), `src/data/` (query absensi & profil),
`src/components/`, dan rute `login`, `(tabs)/absen`, `riwayat`, `profil`.

## Memulai

1. Prasyarat: Node.js 20+, dan app **Expo Go** di HP Android (atau emulator).
2. Install & konfigurasi:
   ```bash
   npm install
   cp .env.example .env.local   # isi URL & publishable key Supabase
   ```
3. Jalankan, lalu scan QR code dengan Expo Go:
   ```bash
   npx expo start
   ```

> Fitur kamera/GPS tertentu nanti mungkin butuh *development build* (`npx expo run:android`
> atau EAS Build) — Expo Go hanya berisi modul native bawaan.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npx expo start` | Server development (scan QR dengan Expo Go). |
| `npx expo install <paket>` | Tambah paket dengan versi yang cocok untuk SDK 58 (**jangan** `npm install` langsung). |
| `npx tsc --noEmit` | Cek tipe TypeScript. |
| `npx expo lint` | Lint. |
| `npx expo-doctor` | Diagnosis konfigurasi & dependency. |

## Keamanan

- Jangan pernah menaruh **secret key / service_role** di app ini — APK bisa dibongkar.
- `.env.local` tidak di-commit (lihat `.gitignore`).
- Lokasi diambil **hanya saat menekan tombol absen** (tanpa pelacakan latar belakang); foto selfie disimpan privat.

---

© 2026 Absensi Ekspedisi · Dikembangkan oleh Dena Pratama.

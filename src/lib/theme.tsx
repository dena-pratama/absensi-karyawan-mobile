// Tema warna app: gelap (seperti panel web) dan terang. Pilihan pengguna: Otomatis (ikut HP) / Terang / Gelap,
// disimpan di HP. Lihat bagian "Tema aktif" di bawah untuk cara warna & gaya ikut berganti.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, Fragment, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";

export type Scheme = "light" | "dark";
export type ThemeMode = "system" | Scheme;

/** Warna dasar (dipakai komponen lama & aksen brand). */
type BaseColors = {
  bg: string;
  panel: string;
  border: string;
  brand: string;
  text: string;
  muted: string;
  danger: string;
  dangerBg: string;
};

/** Warna desain Stitch (login, check in/out, riwayat, profil, kasbon). */
type AppColors = {
  surface: string;
  card: string;
  cardHigh: string;
  input: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  primary: string;
  tint: string;
  onPrimary: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  absent: string;
  absentBg: string;
  /** Latar kotak info (aksen brand tipis). */
  infoBg: string;
  /** Garis tipis kartu. */
  cardBorder: string;
  /** Bayangan kartu / logo. */
  shadow: string;
  /** Cahaya tombol utama. */
  glow: string;
};

export type Palette = { scheme: Scheme; colors: BaseColors; c: AppColors };

const dark: Palette = {
  scheme: "dark",
  colors: {
    bg: "#12151c",
    panel: "#161922",
    border: "#222736",
    brand: "#00d2ff",
    text: "#ffffff",
    muted: "#9ca3af",
    danger: "#f87171",
    dangerBg: "#2a1618",
  },
  c: {
    surface: "#0b1321",
    card: "#18202e",
    cardHigh: "#222a39",
    input: "#141720",
    onSurface: "#dbe2f7",
    onSurfaceVariant: "#bbc9cf",
    outline: "#859399",
    outlineVariant: "#3c494e",
    primary: "#a5e7ff",
    tint: "#47d6ff",
    onPrimary: "#003543",
    success: "#10b981",
    successBg: "rgba(2, 44, 34, 0.4)",
    warning: "#f59e0b",
    warningBg: "rgba(69, 26, 3, 0.4)",
    absent: "#f43f5e",
    absentBg: "rgba(76, 5, 25, 0.4)",
    infoBg: "rgba(0, 210, 255, 0.1)",
    cardBorder: "rgba(255, 255, 255, 0.04)",
    shadow: "rgba(6, 14, 28, 0.8)",
    glow: "rgba(0, 210, 255, 0.35)",
  },
};

const light: Palette = {
  scheme: "light",
  colors: {
    bg: "#f4f6fa",
    panel: "#ffffff",
    border: "#e2e8f0",
    // Cyan lebih gelap supaya tetap terbaca di latar putih.
    brand: "#0891b2",
    text: "#0f172a",
    muted: "#64748b",
    danger: "#dc2626",
    dangerBg: "#fee2e2",
  },
  c: {
    surface: "#f4f6fa",
    card: "#ffffff",
    cardHigh: "#e8edf3",
    input: "#eef2f7",
    onSurface: "#111827",
    onSurfaceVariant: "#4b5563",
    outline: "#6b7280",
    outlineVariant: "#9ca3af",
    primary: "#0e7490",
    tint: "#0891b2",
    onPrimary: "#ffffff",
    success: "#059669",
    successBg: "#d1fae5",
    warning: "#b45309",
    warningBg: "#fef3c7",
    absent: "#e11d48",
    absentBg: "#ffe4e6",
    infoBg: "#e0f7fc",
    cardBorder: "#e2e8f0",
    shadow: "rgba(15, 23, 42, 0.08)",
    glow: "rgba(8, 145, 178, 0.25)",
  },
};

export const palettes: Record<Scheme, Palette> = { dark, light };

// Font Inter (dimuat di src/app/_layout.tsx).
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

// ---------------------------------------------------------------------------
// Tema aktif. `colors`, `appColors`, dan gaya dari themedStyles() selalu membaca tema yang sedang
// dipakai. Saat tema berganti, ThemeProvider memuat ulang tampilan (key = tema) supaya semua layar
// memakai warna baru, jadi komponen cukup memakai `c.surface` / `styles.x` seperti biasa.
// ---------------------------------------------------------------------------

let current: Scheme = "dark";

function activate(scheme: Scheme) {
  current = scheme;
}

function live<T extends object>(pick: (p: Palette) => T): T {
  return new Proxy({} as T, {
    get: (_target, key) => pick(palettes[current])[key as keyof T],
    ownKeys: () => Reflect.ownKeys(pick(palettes[current])),
    getOwnPropertyDescriptor: (_target, key) => ({
      enumerable: true,
      configurable: true,
      value: pick(palettes[current])[key as keyof T],
    }),
  });
}

/** Warna dasar tema aktif. */
export const colors: BaseColors = live((p) => p.colors);
/** Warna desain Stitch tema aktif. */
export const appColors: AppColors = live((p) => p.c);

/** Seperti StyleSheet.create, tapi nilainya mengikuti tema aktif (dibuat sekali per tema). */
export function themedStyles<S extends Parameters<typeof StyleSheet.create>[0]>(factory: () => S & Parameters<typeof StyleSheet.create>[0]): Readonly<S> {
  const cache: Partial<Record<Scheme, Readonly<S>>> = {};
  return live(() => (cache[current] ??= StyleSheet.create(factory())));
}

type Theme = {
  scheme: Scheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** false selama pilihan tema tersimpan belum dibaca (splash tetap tampil). */
  ready: boolean;
};

const STORAGE_KEY = "theme-mode";
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    // Penyimpanan bisa gagal (mis. pratinjau web saat render server) → pakai "system".
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && (saved === "light" || saved === "dark" || saved === "system")) setModeState(saved);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme = mode === "system" ? (system === "light" ? "light" : "dark") : mode;
  // Tema aktif dipasang sebelum anak-anaknya dirender (lihat "Tema aktif" di atas).
  activate(scheme);
  const value = useMemo(() => ({ scheme, mode, setMode, ready }), [scheme, mode, setMode, ready]);
  return (
    <ThemeContext value={value}>
      <Fragment key={scheme}>{children}</Fragment>
    </ThemeContext>
  );
}

export function useTheme(): Theme {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam <ThemeProvider>");
  return ctx;
}

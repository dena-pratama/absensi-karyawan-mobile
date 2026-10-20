// Warna tema gelap — disamakan dengan panel web.
export const colors = {
  bg: "#12151c",
  panel: "#161922",
  border: "#222736",
  brand: "#00d2ff",
  text: "#ffffff",
  muted: "#9ca3af",
  danger: "#f87171",
  dangerBg: "#2a1618",
} as const;

// Warna dari desain Stitch (login, check in/out, riwayat, profil).
export const appColors = {
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
} as const;

// Font Inter (dimuat di src/app/_layout.tsx).
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

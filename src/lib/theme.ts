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

// Warna dari desain layar login (Stitch: mobile_login_absensi_ekspedisi).
export const loginColors = {
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
} as const;

// Font Inter (dimuat di src/app/_layout.tsx).
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;

import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";

import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { Icon } from "../Icon";
import { ActionButton, Card, CardTitle, ChipButton, kit, Notice, Pill } from "../kit";

/**
 * Foto selfie dengan kamera depan. Kamera hanya dinyalakan saat layar sedang dibuka (`active`)
 * dan belum ada foto, supaya hemat baterai dan tidak bentrok dengan tab lain.
 */
export function SelfieCard({
  active,
  photoUri,
  onCapture,
  onReset,
  disabled,
}: {
  active: boolean;
  photoUri: string | null;
  onCapture: (uri: string) => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      onCapture(photo.uri);
    } catch {
      setError("Gagal mengambil foto. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  let body: React.ReactNode;
  if (photoUri) {
    body = (
      <View style={styles.frame}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={styles.overlayBar}>
          <View style={styles.overlayLeft}>
            <Icon android="check_circle" ios="checkmark.circle.fill" size={18} color={c.success} />
            <Text style={styles.overlayText}>Foto siap dikirim</Text>
          </View>
          {!disabled && <ChipButton label="Ulangi" icon={{ android: "photo_camera", ios: "camera" }} onPress={onReset} />}
        </View>
      </View>
    );
  } else if (!permission) {
    body = <ActivityIndicator color={colors.brand} />;
  } else if (!permission.granted) {
    body = (
      <View style={{ gap: 12 }}>
        <Notice
          tone="warning"
          icon={{ android: "no_photography", ios: "camera.badge.ellipsis" }}
          title="Izin kamera dibutuhkan"
          message={
            permission.canAskAgain
              ? "Kamera dipakai untuk foto selfie sebagai bukti kehadiran."
              : "Izin kamera ditolak. Buka Pengaturan HP → Aplikasi → izinkan Kamera untuk app ini."
          }
        />
        {permission.canAskAgain ? (
          <ActionButton label="Izinkan Kamera" variant="secondary" onPress={requestPermission} />
        ) : (
          <ActionButton label="Buka Pengaturan" variant="secondary" onPress={() => Linking.openSettings()} />
        )}
      </View>
    );
  } else {
    body = (
      <View style={{ gap: 12 }}>
        <View style={styles.frame}>
          {active ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              mirror
              onCameraReady={() => setReady(true)}
            />
          ) : null}
          {/* Bingkai sudut & panduan wajah */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.faceGuide} pointerEvents="none" />
          <Text style={styles.guideText}>Posisikan wajah di dalam lingkaran</Text>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <ActionButton
          label="Ambil Foto"
          variant="secondary"
          icon={{ android: "photo_camera", ios: "camera.fill" }}
          onPress={capture}
          loading={busy}
          disabled={!ready || disabled}
        />
      </View>
    );
  }

  return (
    <Card>
      <CardTitle
        icon={{ android: "face", ios: "person.crop.circle" }}
        label="Foto Selfie"
        right={photoUri ? <Pill tone="success" label="Siap" /> : <Pill tone="muted" label="Wajib" />}
      />
      {body}
      <Text style={kit.muted}>Foto disimpan privat dan hanya bisa dilihat admin / SPV cabang Anda.</Text>
    </Card>
  );
}

const CORNER = 26;

const styles = themedStyles(() => ({
  frame: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: c.input,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.brand },
  cornerTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  faceGuide: {
    width: "62%",
    aspectRatio: 0.8,
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(0, 210, 255, 0.6)",
  },
  guideText: {
    position: "absolute",
    bottom: 18,
    color: c.onSurface,
    fontFamily: fonts.medium,
    fontSize: 12,
    backgroundColor: "rgba(11, 19, 33, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  overlayBar: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(11, 19, 33, 0.85)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  overlayLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  overlayText: { color: c.onSurface, fontFamily: fonts.medium, fontSize: 12 },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 12 },
}));

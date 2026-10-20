import { StyleSheet, Text, View } from "react-native";
import { formatDateLong, todayWIB } from "@/shared/format";

/** Layar sementara — akan diganti alur Login → Absen (GPS + selfie). */
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Absensi Ekspedisi</Text>
      <Text style={styles.subtitle}>{formatDateLong(todayWIB())}</Text>
      <Text style={styles.note}>Aplikasi mobile sedang dikembangkan.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#12151c", padding: 24 },
  title: { color: "#ffffff", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#00d2ff", fontSize: 14, marginTop: 6 },
  note: { color: "#9ca3af", fontSize: 13, marginTop: 16 },
});

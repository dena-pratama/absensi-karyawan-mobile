import { Pressable, Text, View } from "react-native";

import { appColors as c, colors, fonts, themedStyles, useTheme, type ThemeMode } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Card, CardTitle, kit } from "./kit";

const OPTIONS: { mode: ThemeMode; label: string; icon: { android: IconName; ios: string } }[] = [
  { mode: "system", label: "Otomatis", icon: { android: "brightness_auto", ios: "circle.lefthalf.filled" } },
  { mode: "light", label: "Terang", icon: { android: "light_mode", ios: "sun.max" } },
  { mode: "dark", label: "Gelap", icon: { android: "dark_mode", ios: "moon" } },
];

/** Pilihan tampilan terang / gelap (disimpan di HP). */
export function ThemeSetting() {
  const { mode, setMode } = useTheme();
  return (
    <Card>
      <CardTitle icon={{ android: "palette", ios: "paintpalette" }} label="Tampilan" />
      <View style={styles.segment}>
        {OPTIONS.map((o) => {
          const active = o.mode === mode;
          return (
            <Pressable
              key={o.mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setMode(o.mode)}
              style={[styles.option, active && styles.optionActive]}
            >
              <Icon {...o.icon} size={20} color={active ? c.onPrimary : c.onSurfaceVariant} />
              <Text style={[styles.label, active && { color: c.onPrimary }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={kit.muted}>Otomatis mengikuti pengaturan tema HP.</Text>
    </Card>
  );
}

const styles = themedStyles(() => ({
  segment: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.input,
  },
  optionActive: { backgroundColor: colors.brand },
  label: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 12 },
}));

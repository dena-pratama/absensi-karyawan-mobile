import { Pressable, Text, View } from "react-native";

import type { BranchInfo } from "@/lib/employee";
import { distanceM, type GpsState } from "@/lib/location";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { Icon } from "../Icon";
import { Card, CardTitle, kit, Pill } from "../kit";

type Ranked = { branch: BranchInfo; distance: number | null; inside: boolean };

/** Urutkan outlet dari yang terdekat ke lokasi HP (outlet tanpa titik GPS di akhir). */
export function rankOutlets(outlets: BranchInfo[], gps: GpsState | null): Ranked[] {
  const fix = gps?.status === "ok" ? gps.fix : null;
  return outlets
    .map((b): Ranked => {
      const distance =
        fix && b.latitude !== null && b.longitude !== null
          ? Math.round(distanceM(fix, { lat: b.latitude, lng: b.longitude }))
          : null;
      return { branch: b, distance, inside: distance !== null && distance <= b.geofence_radius_m };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.branch.code.localeCompare(b.branch.code));
}

/** Pilihan outlet tempat absen (SPV): jarak & status dalam radius per outlet. */
export function OutletPicker({
  ranked,
  value,
  onChange,
  disabled,
  title,
}: {
  ranked: Ranked[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <Card>
      <CardTitle icon={{ android: "storefront", ios: "storefront" }} label={title} />
      {ranked.map(({ branch, distance, inside }) => {
        const active = branch.id === value;
        return (
          <Pressable
            key={branch.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(branch.id)}
            style={[styles.row, active && styles.rowActive]}
          >
            <Icon
              android={active ? "radio_button_checked" : "radio_button_unchecked"}
              ios={active ? "largecircle.fill.circle" : "circle"}
              size={20}
              color={active ? colors.brand : c.outline}
            />
            <View style={{ flex: 1 }}>
              <Text style={kit.strong} numberOfLines={1}>
                {branch.code} - {branch.name}
              </Text>
              <Text style={kit.muted}>
                {branch.latitude === null
                  ? "Titik GPS belum diatur admin"
                  : distance === null
                    ? `Batas ${branch.geofence_radius_m} m`
                    : `${distance} m · batas ${branch.geofence_radius_m} m`}
              </Text>
            </View>
            {distance !== null && <Pill tone={inside ? "success" : "muted"} label={inside ? "Dalam area" : "Di luar"} />}
          </Pressable>
        );
      })}
      <Text style={styles.hint}>Outlet terdekat dipilih otomatis. Ketuk untuk mengganti.</Text>
    </Card>
  );
}

const styles = themedStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.input,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: { borderColor: colors.brand },
  hint: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 11 },
}));

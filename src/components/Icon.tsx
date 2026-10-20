import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ColorValue } from "react-native";

export type IconName = NonNullable<Exclude<SymbolViewProps["name"], string>["android"]>;

/** Ikon Material Symbols (Android/web) dengan padanan SF Symbols di iOS. */
export function Icon({ android, ios, size = 20, color }: { android: IconName; ios: string; size?: number; color: ColorValue }) {
  return (
    <SymbolView
      name={{ android, ios: ios as never, web: android }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

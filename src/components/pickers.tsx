// Pemilih sederhana tanpa library tambahan: chip cabang, langkah tanggal, dan daftar pilihan (modal).

import { useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong } from "@/shared/format";
import { Icon } from "./Icon";
import { kit } from "./kit";

/** Pilihan cabang berbentuk chip yang bisa digeser (untuk SPV yang memegang beberapa cabang). */
export function BranchChips({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; code: string; name: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {branches.map((b) => {
        const active = b.id === value;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(b.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipCode, active && { color: c.onPrimary }]}>{b.code}</Text>
            <Text style={[styles.chipName, active && { color: c.onPrimary }]} numberOfLines={1}>
              {b.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Tambah / kurang hari pada tanggal YYYY-MM-DD (UTC, aman dari zona waktu). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tanggal dengan tombol ‹ › (dibatasi min / max). */
export function DateStepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label?: string;
  value: string;
  onChange: (ymd: string) => void;
  min?: string;
  max?: string;
}) {
  const canPrev = !min || value > min;
  const canNext = !max || value < max;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={kit.label}>{label}</Text> : null}
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel="Hari sebelumnya"
          disabled={!canPrev}
          onPress={() => onChange(addDays(value, -1))}
          hitSlop={8}
          style={[styles.stepBtn, !canPrev && { opacity: 0.3 }]}
        >
          <Icon android="chevron_left" ios="chevron.left" size={22} color={c.onSurface} />
        </Pressable>
        <Text style={styles.stepText}>{formatDateLong(value)}</Text>
        <Pressable
          accessibilityLabel="Hari berikutnya"
          disabled={!canNext}
          onPress={() => onChange(addDays(value, 1))}
          hitSlop={8}
          style={[styles.stepBtn, !canNext && { opacity: 0.3 }]}
        >
          <Icon android="chevron_right" ios="chevron.right" size={22} color={c.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

export type PickOption = { id: string; title: string; subtitle?: string };

/** Kolom pilihan: menampilkan pilihan terpilih; ketuk → daftar dengan pencarian. */
export function SelectField({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  options: PickOption[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => `${o.title} ${o.subtitle ?? ""}`.toLowerCase().includes(q))
    : options;

  return (
    <View style={{ gap: 6 }}>
      <Text style={kit.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        style={[styles.select, disabled && { opacity: 0.5 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={selected ? kit.strong : styles.placeholder} numberOfLines={1}>
            {selected?.title ?? placeholder}
          </Text>
          {selected?.subtitle ? (
            <Text style={kit.muted} numberOfLines={1}>
              {selected.subtitle}
            </Text>
          ) : null}
        </View>
        <Icon android="expand_more" ios="chevron.down" size={20} color={c.outline} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable accessibilityLabel="Tutup" onPress={() => setOpen(false)} hitSlop={10}>
              <Icon android="close" ios="xmark" size={24} color={c.onSurface} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Icon android="search" ios="magnifyingglass" size={20} color={c.outline} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cari…"
              placeholderTextColor={c.outlineVariant}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
            ListEmptyComponent={<Text style={[kit.muted, { textAlign: "center", marginTop: 24 }]}>Tidak ada pilihan.</Text>}
            renderItem={({ item }) => {
              const active = item.id === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  style={[styles.option, active && styles.optionActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={kit.strong}>{item.title}</Text>
                    {item.subtitle ? <Text style={kit.muted}>{item.subtitle}</Text> : null}
                  </View>
                  {active && <Icon android="check" ios="checkmark" size={20} color={colors.brand} />}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = themedStyles(() => ({
  chips: { gap: 8, paddingVertical: 2 },
  chip: { backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 200 },
  chipActive: { backgroundColor: colors.brand },
  chipCode: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 13 },
  chipName: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 11 },

  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.input,
    borderRadius: 10,
    padding: 6,
  },
  stepBtn: { padding: 8, borderRadius: 8, backgroundColor: c.cardHigh },
  stepText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 14, flex: 1, textAlign: "center" },

  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  placeholder: { color: c.outlineVariant, fontFamily: fonts.medium, fontSize: 14 },

  modal: { flex: 1, backgroundColor: c.surface },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 18 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: c.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: c.onSurface, fontFamily: fonts.medium, fontSize: 14, padding: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.card,
    borderRadius: 10,
    padding: 12,
  },
  optionActive: { borderWidth: 1, borderColor: colors.brand },
}));

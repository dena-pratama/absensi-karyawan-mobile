// Layar Libur: jatah libur periode ini, pengajuan libur (jatah / off pengganti), pindah off, tukar off dengan
// rekan, dan (untuk SPV / Office) persetujuan pengajuan libur & tukar off. Aturan di server (fungsi day_off_*).

import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";

import { useAuth } from "@/lib/auth";
import {
  cancelDayOff,
  cancelSwap,
  DAY_OFF_NOTE_MAX,
  DAY_OFF_STATUS_LABEL,
  decideDayOff,
  decideSwap,
  fetchDayOffQuota,
  fetchMyDaysOff,
  fetchPendingDaysOff,
  fetchSwapOptions,
  fetchSwaps,
  friendlyDayOffError,
  requestDayOff,
  requestSwap,
  respondSwap,
  SWAP_STATUS_LABEL,
  type DayOff,
  type DayOffKind,
  type DayOffQuota,
  type DayOffStatus,
  type Swap,
  type SwapOption,
} from "@/lib/dayoff";
import { useEmployee } from "@/lib/employee";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong, todayWIB } from "@/shared/format";
import { attendsSelf } from "@/shared/labels";
import { Icon } from "./Icon";
import { ActionButton, Card, CardTitle, ChipButton, kit, LoadingCard, Notice, Pill, TabScreen, type Tone } from "./kit";
import { addDays, DateStepper, SelectField } from "./pickers";

/** "26 Sep s/d 25 Okt 2026" */
function formatPeriod(start: string, end: string) {
  const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T00:00:00Z`));
  return `${fmt(start, { day: "numeric", month: "short" })} s/d ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Kembali", style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

const STATUS_TONE: Record<DayOffStatus, Tone> = {
  diajukan: "warning",
  disetujui: "success",
  ditolak: "danger",
  dibatalkan: "muted",
  dipindah: "muted",
  masuk: "info",
};

const dateOrDash = (d: string | null) => (d ? formatDateLong(d) : "-");

// ---------------------------------------------------------------------------
// Kartu jatah
// ---------------------------------------------------------------------------

function QuotaCard({ q }: { q: DayOffQuota }) {
  return (
    <Card>
      <CardTitle
        icon={{ android: "event_available", ios: "calendar" }}
        label="Jatah Libur"
        right={<Pill tone="muted" label={formatPeriod(q.periodStart, q.periodEnd)} />}
      />
      <View style={styles.quotaRow}>
        <View style={styles.quotaBox}>
          <Text style={kit.label}>Sisa jatah</Text>
          <Text style={styles.quotaValue}>
            {q.available}
            <Text style={styles.quotaUnit}> / {q.quota} hari</Text>
          </Text>
          <Text style={kit.muted}>
            Terpakai {q.used}
            {q.pending > 0 ? ` · menunggu ${q.pending}` : ""}
          </Text>
        </View>
        <View style={styles.quotaBox}>
          <Text style={kit.label}>Off pengganti</Text>
          <Text style={styles.quotaValue}>
            {q.credits}
            <Text style={styles.quotaUnit}> hari</Text>
          </Text>
          <Text style={kit.muted}>
            {q.credits > 0 && q.nextCreditExpiry ? `Terdekat habis ${formatDateLong(q.nextCreditExpiry)}` : "Dari masuk di hari libur"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Form pengajuan / pindah libur
// ---------------------------------------------------------------------------

function RequestForm({
  q,
  moving,
  onCancelMove,
  onDone,
}: {
  q: DayOffQuota;
  /** Libur yang sedang dipindah (pindah off); null = pengajuan baru. */
  moving: DayOff | null;
  onCancelMove: () => void;
  onDone: (msg: string) => void;
}) {
  const today = todayWIB();
  const [date, setDate] = useState(addDays(today, 1));
  const [kind, setKind] = useState<DayOffKind>(q.available > 0 || q.credits === 0 ? "jatah" : "pengganti");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canJatah = q.available > 0;
  const canCredit = q.credits > 0;
  const blocked = !moving && !(kind === "jatah" ? canJatah : canCredit);

  async function submit() {
    setBusy(true);
    setError(null);
    const err = await requestDayOff(date, moving?.kind ?? kind, note, moving?.id);
    setBusy(false);
    if (err) return setError(err);
    setNote("");
    onDone(
      moving
        ? `Pindah libur ${formatDateLong(moving.offDate)} ke ${formatDateLong(date)} diajukan. Menunggu persetujuan.`
        : `Libur ${formatDateLong(date)} diajukan. Menunggu persetujuan.`,
    );
  }

  return (
    <Card>
      <CardTitle
        icon={moving ? { android: "event_repeat", ios: "calendar.badge.clock" } : { android: "edit_calendar", ios: "calendar.badge.plus" }}
        label={moving ? "Pindah Libur" : "Ajukan Libur"}
        right={moving ? <ChipButton label="Batal" icon={{ android: "close", ios: "xmark" }} onPress={onCancelMove} /> : null}
      />
      {moving && (
        <Text style={kit.body}>
          Pindahkan libur <Text style={kit.strong}>{formatDateLong(moving.offDate)}</Text> ke tanggal baru (tidak memotong jatah lagi).
        </Text>
      )}
      <DateStepper label={moving ? "Tanggal baru" : "Tanggal libur"} value={date} min={today} onChange={setDate} />
      {!moving && (
        <View style={{ gap: 6 }}>
          <Text style={kit.label}>Pakai</Text>
          <View style={styles.segment}>
            {(
              [
                { k: "jatah", label: `Jatah (${q.available})`, ok: canJatah },
                { k: "pengganti", label: `Off pengganti (${q.credits})`, ok: canCredit },
              ] as const
            ).map((o) => {
              const active = kind === o.k;
              return (
                <Pressable
                  key={o.k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active, disabled: !o.ok }}
                  disabled={!o.ok || busy}
                  onPress={() => setKind(o.k)}
                  style={[styles.segBtn, active && styles.segBtnActive, !o.ok && { opacity: 0.4 }]}
                >
                  <Text style={[styles.segText, active && { color: c.onPrimary }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <View style={{ gap: 6 }}>
        <Text style={kit.label}>Keterangan (opsional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="mis. acara keluarga"
          placeholderTextColor={c.outlineVariant}
          maxLength={DAY_OFF_NOTE_MAX}
          multiline
          style={styles.note}
          editable={!busy}
        />
      </View>
      {blocked && (
        <Text style={kit.muted}>
          {kind === "jatah" ? "Jatah libur periode ini sudah habis." : "Belum punya saldo off pengganti."}
        </Text>
      )}
      {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Belum terkirim" message={error} />}
      <ActionButton
        label={moving ? "Ajukan Pindah Libur" : "Ajukan Libur"}
        icon={{ android: "send", ios: "paperplane" }}
        onPress={submit}
        loading={busy}
        disabled={blocked}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tukar off dengan rekan
// ---------------------------------------------------------------------------

function SwapForm({
  myOffs,
  options,
  initialMyOff,
  onDone,
}: {
  myOffs: DayOff[];
  options: SwapOption[];
  initialMyOff: string | null;
  onDone: (msg: string) => void;
}) {
  const [myOff, setMyOff] = useState<string | null>(initialMyOff);
  const [partnerOff, setPartnerOff] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!myOff || !partnerOff) return setError("Pilih libur Anda dan libur rekan.");
    setBusy(true);
    setError(null);
    const err = await requestSwap(myOff, partnerOff, note);
    setBusy(false);
    if (err) return setError(err);
    setPartnerOff(null);
    setNote("");
    onDone("Permintaan tukar off terkirim. Menunggu konfirmasi rekan, lalu persetujuan atasan.");
  }

  return (
    <Card>
      <CardTitle icon={{ android: "swap_horiz", ios: "arrow.left.arrow.right" }} label="Tukar Off dengan Rekan" />
      <Text style={kit.muted}>Tukar tanggal libur yang sudah disetujui dengan rekan satu cabang.</Text>
      {myOffs.length === 0 ? (
        <Text style={kit.muted}>Belum ada libur Anda yang disetujui dan belum lewat.</Text>
      ) : options.length === 0 ? (
        <Text style={kit.muted}>Belum ada libur rekan satu cabang yang bisa ditukar.</Text>
      ) : (
        <>
          <SelectField
            label="Libur saya"
            placeholder="Pilih libur Anda"
            options={myOffs.map((o) => ({ id: o.id, title: formatDateLong(o.offDate) }))}
            value={myOff}
            onChange={setMyOff}
            disabled={busy}
          />
          <SelectField
            label="Libur rekan"
            placeholder="Pilih libur rekan"
            options={options.map((o) => ({
              id: o.offId,
              title: formatDateLong(o.offDate),
              subtitle: o.name ? `${o.name}${o.nik ? ` · ${o.nik}` : ""}` : "Rekan satu cabang",
            }))}
            value={partnerOff}
            onChange={setPartnerOff}
            disabled={busy}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Keterangan (opsional)"
            placeholderTextColor={c.outlineVariant}
            maxLength={DAY_OFF_NOTE_MAX}
            style={styles.note}
            editable={!busy}
          />
          {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Belum terkirim" message={error} />}
          <ActionButton label="Kirim Permintaan Tukar" variant="secondary" icon={{ android: "swap_horiz", ios: "arrow.left.arrow.right" }} onPress={submit} loading={busy} />
        </>
      )}
    </Card>
  );
}

function swapTitle(s: Swap) {
  const who = (name: string | null) => name ?? "Rekan";
  return `${who(s.requesterName)} (${dateOrDash(s.requesterOffDate)}) ⇄ ${who(s.partnerName)} (${dateOrDash(s.partnerOffDate)})`;
}

// ---------------------------------------------------------------------------
// Layar
// ---------------------------------------------------------------------------

type Data = {
  quota: DayOffQuota | null;
  mine: DayOff[];
  options: SwapOption[];
  swaps: Swap[];
  pending: DayOff[];
  error: string | null;
};

export function LiburScreen() {
  const { role } = useAuth();
  const { profile, error: profileError } = useEmployee();
  const isManager = attendsSelf(role); // SPV & Office ikut menyetujui
  const myId = profile?.id ?? null;
  const today = todayWIB();
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState<DayOff | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Data> => {
    try {
      const [quota, mine, options, swaps, pending] = await Promise.all([
        myId ? fetchDayOffQuota() : Promise.resolve(null),
        myId ? fetchMyDaysOff(myId) : Promise.resolve([]),
        myId ? fetchSwapOptions(myId, today) : Promise.resolve([]),
        fetchSwaps(),
        isManager ? fetchPendingDaysOff(myId) : Promise.resolve([]),
      ]);
      return { quota, mine, options, swaps, pending, error: null };
    } catch (e) {
      return { quota: null, mine: [], options: [], swaps: [], pending: [], error: friendlyDayOffError(e as { code?: string; message: string }) };
    }
  }, [myId, today, isManager]);

  useEffect(() => {
    let active = true;
    load().then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function reload() {
    setData(await load());
  }

  async function onRefresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  /** Jalankan aksi, tampilkan hasilnya, lalu muat ulang. */
  async function act(run: () => Promise<string | null>, ok: string) {
    const err = await run();
    setMessage(err ? { tone: "danger", text: err } : { tone: "success", text: ok });
    await reload();
  }

  const futureApproved = (data?.mine ?? []).filter((o) => o.status === "disetujui" && o.offDate > today);
  const incoming = (data?.swaps ?? []).filter((s) => s.partnerId === myId && s.status === "menunggu_rekan");
  const outgoing = (data?.swaps ?? []).filter(
    (s) => s.requesterId === myId && (s.status === "menunggu_rekan" || s.status === "menunggu_atasan"),
  );
  const toApproveSwaps = isManager
    ? (data?.swaps ?? []).filter((s) => s.status === "menunggu_atasan" && s.requesterId !== myId && s.partnerId !== myId)
    : [];

  return (
    <TabScreen title="Libur" refreshing={refreshing} onRefresh={onRefresh}>
      {message && (
        <Notice tone={message.tone} icon={{ android: "info", ios: "info.circle" }} title={message.text} />
      )}

      {!data ? (
        <LoadingCard label="Memuat jadwal libur…" />
      ) : data.error ? (
        <Notice tone="warning" icon={{ android: "info", ios: "info.circle" }} title="Libur belum bisa dibuka" message={data.error}>
          <View style={{ marginTop: 8 }}>
            <ActionButton label="Coba lagi" variant="secondary" onPress={onRefresh} />
          </View>
        </Notice>
      ) : (
        <>
          {/* Persetujuan (SPV / Office) */}
          {isManager && (data.pending.length > 0 || toApproveSwaps.length > 0) && (
            <Card>
              <CardTitle
                icon={{ android: "approval", ios: "checkmark.seal" }}
                label="Perlu Persetujuan"
                right={<Pill tone="warning" label={`${data.pending.length + toApproveSwaps.length}`} />}
              />
              {data.pending.map((o) => (
                <View key={o.id} style={styles.item}>
                  <Text style={kit.strong}>{o.employeeName ?? "Karyawan"}</Text>
                  <Text style={kit.muted}>
                    {o.nik ? `${o.nik} · ` : ""}
                    {o.replacesId ? "Pindah libur ke " : "Libur "}
                    {formatDateLong(o.offDate)} · {o.kind === "pengganti" ? "off pengganti" : "jatah"}
                  </Text>
                  {o.note ? <Text style={kit.muted}>“{o.note}”</Text> : null}
                  <View style={styles.actions}>
                    <ChipButton label="Tolak" icon={{ android: "close", ios: "xmark" }} onPress={() => act(() => decideDayOff(o.id, false), "Pengajuan libur ditolak.")} />
                    <ChipButton label="Setujui" icon={{ android: "check", ios: "checkmark" }} onPress={() => act(() => decideDayOff(o.id, true), "Pengajuan libur disetujui.")} />
                  </View>
                </View>
              ))}
              {toApproveSwaps.map((s) => (
                <View key={s.id} style={styles.item}>
                  <Text style={kit.strong}>Tukar off</Text>
                  <Text style={kit.muted}>{swapTitle(s)}</Text>
                  {s.note ? <Text style={kit.muted}>“{s.note}”</Text> : null}
                  <View style={styles.actions}>
                    <ChipButton label="Tolak" icon={{ android: "close", ios: "xmark" }} onPress={() => act(() => decideSwap(s.id, false), "Tukar off ditolak.")} />
                    <ChipButton label="Setujui" icon={{ android: "check", ios: "checkmark" }} onPress={() => act(() => decideSwap(s.id, true), "Tukar off disetujui, tanggal libur sudah ditukar.")} />
                  </View>
                </View>
              ))}
            </Card>
          )}

          {!myId ? (
            <Notice
              tone="warning"
              icon={{ android: "link_off", ios: "link" }}
              title="Belum bisa mengajukan libur"
              message={profileError ?? "Akun ini belum terhubung ke data karyawan. Hubungi admin."}
            />
          ) : (
            <>
              {data.quota && <QuotaCard q={data.quota} />}

              {/* Permintaan tukar dari rekan */}
              {incoming.length > 0 && (
                <Card>
                  <CardTitle icon={{ android: "inbox", ios: "tray" }} label="Permintaan Tukar dari Rekan" />
                  {incoming.map((s) => (
                    <View key={s.id} style={styles.item}>
                      <Text style={kit.body}>
                        {s.requesterName ?? "Rekan"} ingin menukar liburnya ({dateOrDash(s.requesterOffDate)}) dengan libur Anda (
                        {dateOrDash(s.partnerOffDate)}).
                      </Text>
                      {s.note ? <Text style={kit.muted}>“{s.note}”</Text> : null}
                      <View style={styles.actions}>
                        <ChipButton label="Tolak" icon={{ android: "close", ios: "xmark" }} onPress={() => act(() => respondSwap(s.id, false), "Permintaan tukar ditolak.")} />
                        <ChipButton label="Terima" icon={{ android: "check", ios: "checkmark" }} onPress={() => act(() => respondSwap(s.id, true), "Tukar diterima. Menunggu persetujuan atasan.")} />
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              {data.quota && (
                <RequestForm
                  key={moving?.id ?? "new"}
                  q={data.quota}
                  moving={moving}
                  onCancelMove={() => setMoving(null)}
                  onDone={async (msg) => {
                    setMoving(null);
                    setMessage({ tone: "success", text: msg });
                    await reload();
                  }}
                />
              )}

              {/* Libur saya */}
              <Card>
                <CardTitle icon={{ android: "event_note", ios: "calendar" }} label="Libur Saya" />
                {data.mine.length === 0 ? (
                  <Text style={kit.muted}>Belum ada pengajuan libur.</Text>
                ) : (
                  data.mine.map((o) => {
                    const future = o.offDate > today;
                    return (
                      <View key={o.id} style={styles.item}>
                        <View style={styles.itemHead}>
                          <View style={{ flex: 1 }}>
                            <Text style={kit.strong}>{formatDateLong(o.offDate)}</Text>
                            <Text style={kit.muted}>
                              {o.kind === "pengganti" ? "Off pengganti" : "Jatah"}
                              {o.replacesId ? " · pindahan" : ""}
                              {o.note ? ` · ${o.note}` : ""}
                            </Text>
                          </View>
                          <Pill tone={STATUS_TONE[o.status]} label={DAY_OFF_STATUS_LABEL[o.status]} />
                        </View>
                        {o.decisionNote ? <Text style={kit.muted}>Catatan atasan: {o.decisionNote}</Text> : null}
                        {(o.status === "diajukan" || (o.status === "disetujui" && future)) && (
                          <View style={styles.actions}>
                            {o.status === "diajukan" && (
                              <ChipButton
                                label="Batalkan"
                                icon={{ android: "close", ios: "xmark" }}
                                onPress={async () => {
                                  if (await confirm("Batalkan pengajuan?", `Libur ${formatDateLong(o.offDate)} dibatalkan.`, "Batalkan")) {
                                    await act(() => cancelDayOff(o.id), "Pengajuan libur dibatalkan.");
                                  }
                                }}
                              />
                            )}
                            {o.status === "disetujui" && future && (
                              <>
                                <ChipButton label="Pindah" icon={{ android: "event_repeat", ios: "calendar.badge.clock" }} onPress={() => setMoving(o)} />
                                <ChipButton label="Tukar" icon={{ android: "swap_horiz", ios: "arrow.left.arrow.right" }} onPress={() => setSwapFrom(o.id)} />
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </Card>

              <SwapForm
                key={swapFrom ?? "swap"}
                myOffs={futureApproved}
                options={data.options}
                initialMyOff={swapFrom}
                onDone={async (msg) => {
                  setSwapFrom(null);
                  setMessage({ tone: "success", text: msg });
                  await reload();
                }}
              />

              {/* Tukar off yang saya ajukan */}
              {outgoing.length > 0 && (
                <Card>
                  <CardTitle icon={{ android: "outbox", ios: "tray.and.arrow.up" }} label="Tukar Off Saya" />
                  {outgoing.map((s) => (
                    <View key={s.id} style={styles.item}>
                      <View style={styles.itemHead}>
                        <Text style={[kit.body, { flex: 1 }]}>{swapTitle(s)}</Text>
                        <Pill tone="warning" label={SWAP_STATUS_LABEL[s.status]} />
                      </View>
                      <View style={styles.actions}>
                        <ChipButton label="Batalkan" icon={{ android: "close", ios: "xmark" }} onPress={() => act(() => cancelSwap(s.id), "Permintaan tukar dibatalkan.")} />
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              <View style={styles.footnote}>
                <Icon android="info" ios="info.circle" size={14} color={c.outline} />
                <Text style={[kit.muted, { flex: 1 }]}>
                  Masuk kerja di hari libur tetap boleh: status jadi Hadir dan Anda mendapat 1 off pengganti.
                </Text>
              </View>
            </>
          )}
        </>
      )}
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  quotaRow: { flexDirection: "row", gap: 10 },
  quotaBox: { flex: 1, backgroundColor: c.input, borderRadius: 10, padding: 12, gap: 2 },
  quotaValue: { color: colors.brand, fontFamily: fonts.bold, fontSize: 26 },
  quotaUnit: { color: c.onSurfaceVariant, fontFamily: fonts.regular, fontSize: 12 },
  segment: { flexDirection: "row", gap: 8 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, backgroundColor: c.input },
  segBtnActive: { backgroundColor: colors.brand },
  segText: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 12 },
  note: {
    minHeight: 48,
    backgroundColor: c.input,
    borderRadius: 10,
    padding: 12,
    color: c.onSurface,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlignVertical: "top",
  },
  item: { backgroundColor: c.input, borderRadius: 10, padding: 12, gap: 6 },
  itemHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  footnote: { flexDirection: "row", gap: 6, alignItems: "flex-start", paddingHorizontal: 4 },
}));

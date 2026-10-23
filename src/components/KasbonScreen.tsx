// Layar Kasbon (semua role yang terhubung ke data karyawan): hitungan plafon, pengajuan, riwayat & bukti.

import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  cancelKasbon,
  displayStatus,
  fetchHistory,
  fetchQuota,
  formatRupiah,
  friendlyKasbonError,
  KASBON_NOTE_MAX,
  proofUrl,
  requestKasbon,
  type Kasbon,
  type KasbonQuota,
} from "@/lib/kasbon";
import { appColors as c, colors, fonts, themedStyles } from "@/lib/theme";
import { formatDateLong, formatTimeWIB, todayWIB } from "@/shared/format";
import { Icon } from "./Icon";
import { ActionButton, Card, CardTitle, ChipButton, kit, LoadingCard, Notice, Pill, TabScreen } from "./kit";

/** "26 Sep s/d 25 Okt 2026" */
function formatPeriod(start: string, end: string) {
  const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opts }).format(new Date(`${ymd}T00:00:00Z`));
  return `${fmt(start, { day: "numeric", month: "short" })} s/d ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
}

const dateOf = (iso: string) => formatDateLong(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso)));

function confirm(title: string, message: string, ok: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Kembali", style: "cancel", onPress: () => resolve(false) },
      { text: ok, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={kit.muted}>{label}</Text>
      <Text style={strong ? styles.rowStrong : kit.strong}>{value}</Text>
    </View>
  );
}

function QuotaCard({ q }: { q: KasbonQuota }) {
  return (
    <Card>
      <CardTitle
        icon={{ android: "account_balance_wallet", ios: "creditcard" }}
        label="Plafon Kasbon"
        right={<Pill tone="muted" label={formatPeriod(q.periodStart, q.periodEnd)} />}
      />
      <View style={styles.big}>
        <Text style={kit.label}>Sisa plafon yang bisa diajukan</Text>
        <Text style={styles.bigValue}>{formatRupiah(q.available)}</Text>
      </View>
      <Row
        label={`Gaji pokok${q.salarySource === "karyawan" ? " (khusus)" : " (jabatan)"}`}
        value={q.baseSalary !== null ? formatRupiah(q.baseSalary) : "-"}
      />
      <Row label={`Gaji harian (÷ ${q.dailyDivisor} hari)`} value={formatRupiah(q.dailyRate)} />
      <Row label="Hari masuk kerja (HK) periode ini" value={`${q.hk} hari`} />
      <Row label={`Plafon (${formatRupiah(q.dailyRate)} × ${q.hk} HK)`} value={formatRupiah(q.plafon)} />
      <Row label="Sudah diajukan / dipakai" value={formatRupiah(q.used)} />
      <Text style={kit.muted}>
        HK dihitung dari absensi berstatus Hadir pada periode gajian ini. Kasbon dilunasi lewat potong gaji.
      </Text>
    </Card>
  );
}

function RequestForm({ q, onDone }: { q: KasbonQuota; onDone: (msg: string) => void }) {
  const [digits, setDigits] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = Number(digits || "0");
  const display = digits ? formatRupiah(amount).slice(2) : "";

  async function submit() {
    if (amount <= 0) return setError("Isi nominal kasbon.");
    if (amount > q.available) return setError(`Nominal melebihi sisa plafon (${formatRupiah(q.available)}).`);
    setBusy(true);
    setError(null);
    const err = await requestKasbon(amount, note);
    setBusy(false);
    if (err) return setError(err);
    setDigits("");
    setNote("");
    onDone(`Kasbon ${formatRupiah(amount)} diajukan. Menunggu persetujuan admin.`);
  }

  return (
    <Card>
      <CardTitle icon={{ android: "request_quote", ios: "doc.text" }} label="Ajukan Kasbon" />
      <View style={{ gap: 6 }}>
        <Text style={kit.label}>Nominal</Text>
        <View style={styles.amountBox}>
          <Text style={styles.rp}>Rp</Text>
          <TextInput
            value={display}
            onChangeText={(t) => setDigits(t.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))}
            placeholder="0"
            placeholderTextColor={c.outlineVariant}
            keyboardType="number-pad"
            style={styles.amountInput}
            editable={!busy}
          />
        </View>
        <View style={styles.chips}>
          {[0.25, 0.5, 1].map((f) => {
            const v = Math.floor(q.available * f);
            return (
              <ChipButton
                key={f}
                label={f === 1 ? "Maksimal" : `${f * 100}%`}
                icon={{ android: "bolt", ios: "bolt" }}
                onPress={() => setDigits(String(v))}
                disabled={busy || v <= 0}
              />
            );
          })}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={kit.label}>Keperluan (opsional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="mis. biaya berobat"
          placeholderTextColor={c.outlineVariant}
          maxLength={KASBON_NOTE_MAX}
          multiline
          style={styles.note}
          editable={!busy}
        />
      </View>
      {error && <Notice tone="danger" icon={{ android: "error", ios: "exclamationmark.circle" }} title="Belum terkirim" message={error} />}
      <ActionButton
        label="Ajukan Kasbon"
        icon={{ android: "send", ios: "paperplane" }}
        onPress={submit}
        loading={busy}
        disabled={amount <= 0}
      />
    </Card>
  );
}

function HistoryCard({ k, onCancel, onProof }: { k: Kasbon; onCancel: () => void; onProof: () => void }) {
  const s = displayStatus(k, todayWIB());
  const steps: string[] = [`Diajukan ${dateOf(k.requestedAt)}, ${formatTimeWIB(k.requestedAt)}`];
  if (k.decidedAt) steps.push(`${k.status === "ditolak" ? "Ditolak" : "Disetujui"} ${dateOf(k.decidedAt)}`);
  if (k.disbursedAt) steps.push(`Dicairkan ${dateOf(k.disbursedAt)}`);
  if (k.settledAt) steps.push(`Lunas ${dateOf(k.settledAt)}`);
  return (
    <Card>
      <View style={styles.histHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.histAmount}>{formatRupiah(k.amount)}</Text>
          <Text style={kit.muted}>
            Periode {formatPeriod(k.periodStart, k.periodEnd)} · plafon {formatRupiah(k.plafon)} ({k.hk} HK)
          </Text>
        </View>
        <Pill tone={s.tone} label={s.label} />
      </View>
      {k.note ? <Text style={kit.body}>{k.note}</Text> : null}
      {k.decisionNote ? <Text style={kit.muted}>Catatan admin: {k.decisionNote}</Text> : null}
      <View style={{ gap: 2 }}>
        {steps.map((t) => (
          <Text key={t} style={kit.muted}>
            · {t}
          </Text>
        ))}
      </View>
      <View style={styles.histActions}>
        {k.proofPhoto && (k.status === "dicairkan" || k.status === "lunas") && (
          <ChipButton label="Lihat bukti" icon={{ android: "image", ios: "photo" }} onPress={onProof} />
        )}
        {k.status === "diajukan" && <ChipButton label="Batalkan" icon={{ android: "close", ios: "xmark" }} onPress={onCancel} />}
      </View>
    </Card>
  );
}

function ProofModal({ url, onClose }: { url: string | null | undefined; onClose: () => void }) {
  return (
    <Modal visible={url !== undefined} animationType="fade" onRequestClose={onClose} transparent>
      <SafeAreaView style={styles.proofBackdrop}>
        <View style={styles.proofHeader}>
          <Text style={styles.proofTitle}>Bukti Pencairan</Text>
          <Pressable accessibilityLabel="Tutup" onPress={onClose} hitSlop={10}>
            <Icon android="close" ios="xmark" size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {url === null ? (
            <Text style={kit.muted}>Foto bukti belum bisa dibuka. Coba lagi.</Text>
          ) : url ? (
            <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          ) : (
            <ActivityIndicator color={colors.brand} />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function KasbonScreen() {
  const [quota, setQuota] = useState<KasbonQuota | null>(null);
  const [history, setHistory] = useState<Kasbon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // undefined = tertutup, "" = memuat, null = gagal, string = url
  const [proof, setProof] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [q, h] = await Promise.all([fetchQuota(), fetchHistory()]);
      return { quota: q, history: h, error: null };
    } catch (e) {
      return { quota: null, history: null, error: friendlyKasbonError(e as { code?: string; message: string }) };
    }
  }, []);

  const apply = useCallback((r: Awaited<ReturnType<typeof load>>) => {
    setQuota(r.quota);
    setHistory(r.history);
    setError(r.error);
  }, []);

  useEffect(() => {
    let active = true;
    load().then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [load, apply]);

  async function onRefresh() {
    setRefreshing(true);
    apply(await load());
    setRefreshing(false);
  }

  async function cancel(k: Kasbon) {
    if (!(await confirm("Batalkan kasbon?", `Pengajuan ${formatRupiah(k.amount)} akan dibatalkan.`, "Batalkan"))) return;
    const err = await cancelKasbon(k.id);
    setMessage(err ?? "Pengajuan kasbon dibatalkan.");
    apply(await load());
  }

  async function openProof(k: Kasbon) {
    if (!k.proofPhoto) return;
    setProof("");
    setProof(await proofUrl(k.proofPhoto));
  }

  const loading = !quota && !error;

  return (
    <TabScreen title="Kasbon" refreshing={refreshing} onRefresh={onRefresh}>
      {loading ? (
        <LoadingCard label="Menghitung plafon…" />
      ) : error ? (
        <Notice tone="warning" icon={{ android: "info", ios: "info.circle" }} title="Kasbon belum bisa dibuka" message={error}>
          <View style={{ marginTop: 8 }}>
            <ActionButton label="Coba lagi" variant="secondary" onPress={onRefresh} />
          </View>
        </Notice>
      ) : quota ? (
        <>
          <QuotaCard q={quota} />
          {message && (
            <Notice
              tone={message.includes("diajukan") || message.includes("dibatalkan") ? "success" : "danger"}
              icon={{ android: "info", ios: "info.circle" }}
              title={message}
            />
          )}
          {quota.salarySource === null ? (
            <Notice
              tone="warning"
              icon={{ android: "payments", ios: "banknote" }}
              title="Gaji pokok belum diatur"
              message="Admin perlu mengatur gaji pokok jabatan Anda di panel web sebelum kasbon bisa diajukan."
            />
          ) : quota.available > 0 ? (
            <RequestForm
              q={quota}
              onDone={async (msg) => {
                setMessage(msg);
                apply(await load());
              }}
            />
          ) : (
            <Notice
              tone="muted"
              icon={{ android: "block", ios: "nosign" }}
              title="Sisa plafon Rp0"
              message="Belum ada plafon yang bisa diajukan di periode ini. Plafon bertambah setiap hari masuk kerja."
            />
          )}

          <Text style={styles.section}>Riwayat Kasbon</Text>
          {history && history.length === 0 ? (
            <Notice tone="muted" icon={{ android: "history", ios: "clock" }} title="Belum ada riwayat kasbon." />
          ) : (
            history?.map((k) => <HistoryCard key={k.id} k={k} onCancel={() => cancel(k)} onProof={() => openProof(k)} />)
          )}
        </>
      ) : null}
      <ProofModal url={proof} onClose={() => setProof(undefined)} />
    </TabScreen>
  );
}

const styles = themedStyles(() => ({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowStrong: { color: colors.brand, fontFamily: fonts.bold, fontSize: 15 },
  big: { backgroundColor: c.input, borderRadius: 10, padding: 14, gap: 4 },
  bigValue: { color: colors.brand, fontFamily: fonts.bold, fontSize: 28, fontVariant: ["tabular-nums"] },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.input,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 52,
  },
  rp: { color: c.onSurfaceVariant, fontFamily: fonts.semibold, fontSize: 16 },
  amountInput: { flex: 1, color: c.onSurface, fontFamily: fonts.bold, fontSize: 20, padding: 0 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  note: {
    minHeight: 64,
    backgroundColor: c.input,
    borderRadius: 10,
    padding: 12,
    color: c.onSurface,
    fontFamily: fonts.medium,
    fontSize: 14,
    textAlignVertical: "top",
  },
  section: { color: c.onSurface, fontFamily: fonts.semibold, fontSize: 15, marginTop: 4 },
  histHead: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  histAmount: { color: c.onSurface, fontFamily: fonts.bold, fontSize: 18 },
  histActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  proofBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  proofHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  proofTitle: { color: "#fff", fontFamily: fonts.semibold, fontSize: 16 },
}));

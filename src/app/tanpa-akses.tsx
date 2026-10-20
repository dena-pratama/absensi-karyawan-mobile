import { useState } from "react";

import { Button, MessageScreen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** Login berhasil tapi akun belum terdaftar di app_user (atau role gagal dibaca karena koneksi). */
export default function TanpaAkses() {
  const { roleError, reloadRole, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    await reloadRole();
    setBusy(false);
  }

  return (
    <MessageScreen
      title={roleError ? "Gagal memuat akses" : "Akun belum diberi akses"}
      message={
        roleError ??
        "Akun Anda sudah bisa masuk, tetapi belum diberi peran (karyawan / SPV). Hubungi admin agar akun diaktifkan."
      }
    >
      <Button label="Coba lagi" onPress={retry} loading={busy} />
      <Button label="Keluar" variant="outline" onPress={signOut} />
    </MessageScreen>
  );
}

// Context sesi login + role akun. Role dibaca dari database lewat fungsi current_app_role()
// (tabel app_user, diatur admin di web: Pengaturan → Pengguna & Akses).

import type { AuthError, Session } from "@supabase/supabase-js";
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

import type { AppRole } from "@/shared/labels";
import { configError, supabase } from "./supabase";

type AuthState = {
  /** true hanya saat app baru dibuka dan sesi tersimpan + role belum selesai dibaca. */
  initializing: boolean;
  session: Session | null;
  /** null = akun belum diberi akses (tidak ada di app_user). */
  role: AppRole | null;
  /** Pesan kalau role gagal dibaca (mis. tidak ada internet). */
  roleError: string | null;
  /** `email` = hasil toLoginEmail() (username sudah diubah jadi email internal). Mengembalikan pesan error (Bahasa Indonesia) atau null kalau berhasil. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  reloadRole: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const ROLES: readonly AppRole[] = ["admin", "spv", "office", "karyawan"];

function isNetworkError(message: string) {
  return /network|fetch|timeout|connection/i.test(message);
}

/** Ubah error login Supabase menjadi pesan ramah. */
function signInErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Username / email atau kata sandi salah.";
    case "email_not_confirmed":
      return "Akun ini belum dikonfirmasi. Hubungi admin.";
    case "user_banned":
      return "Akun ini sedang dinonaktifkan. Hubungi admin.";
    case "over_request_rate_limit":
      return "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
  }
  if (error.status === 0 || isNetworkError(error.message)) {
    return "Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.";
  }
  return "Gagal masuk. Coba lagi beberapa saat lagi.";
}

type Access = { session: Session | null; role: AppRole | null; roleError: string | null };

async function readAccess(session: Session | null): Promise<Access> {
  if (!session) return { session, role: null, roleError: null };
  const { data, error } = await supabase.rpc("current_app_role");
  if (error) {
    return {
      session,
      role: null,
      roleError: isNetworkError(error.message)
        ? "Tidak bisa terhubung ke server. Periksa koneksi internet."
        : "Gagal membaca hak akses akun. Coba lagi.",
    };
  }
  return { session, role: ROLES.includes(data as AppRole) ? (data as AppRole) : null, roleError: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Sesi & role disimpan bersamaan supaya layar tidak sempat "berkedip" ke layar yang salah.
  const [access, setAccess] = useState<Access>({ session: null, role: null, roleError: null });
  const [initializing, setInitializing] = useState(!configError);

  useEffect(() => {
    if (configError) return;
    let active = true;

    // Sesi tersimpan di HP dibaca saat app dibuka (INITIAL_SESSION); setelah itu ikuti login/logout.
    // Callback onAuthStateChange tidak boleh menunggu panggilan Supabase lain (bisa macet),
    // jadi role dibaca lewat setTimeout.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setTimeout(async () => {
          const result = await readAccess(next);
          if (!active) return;
          setAccess(result);
          setInitializing(false);
        }, 0);
      } else {
        // TOKEN_REFRESHED / USER_UPDATED: role tidak berubah, cukup perbarui sesi.
        setAccess((prev) => ({ ...prev, session: next }));
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (configError) return configError;
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? signInErrorMessage(error) : null; // role dibaca lewat onAuthStateChange (SIGNED_IN)
  }, []);

  const signOut = useCallback(async () => {
    // scope "local": keluar di HP ini saja, tetap berhasil walau sedang offline.
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  const { session } = access;
  const reloadRole = useCallback(async () => {
    setAccess(await readAccess(session));
  }, [session]);

  return (
    <AuthContext value={{ initializing, ...access, signIn, signOut, reloadRole }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}

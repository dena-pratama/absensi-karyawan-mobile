// Client Supabase untuk app mobile — memakai database yang SAMA dengan panel web.
// Hanya URL + publishable key (aman ikut di APK); akses data dijaga RLS di database.
// JANGAN PERNAH menaruh secret key / service_role di sini.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import aesjs from "aes-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Pesan untuk layar "konfigurasi belum lengkap"; null kalau env sudah benar. */
export const configError: string | null = (() => {
  if (!SUPABASE_URL || SUPABASE_URL.includes("xxxx")) {
    return "EXPO_PUBLIC_SUPABASE_URL belum diisi di file .env.local.";
  }
  if (!/^https?:\/\//.test(SUPABASE_URL)) {
    return "EXPO_PUBLIC_SUPABASE_URL harus diawali https:// (contoh: https://abcd.supabase.co).";
  }
  if (!SUPABASE_PUBLISHABLE_KEY) {
    return "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi di file .env.local.";
  }
  return null;
})();

/**
 * Penyimpanan sesi login di HP (pola "LargeSecureStore" dari panduan Supabase untuk Expo):
 * sesi dienkripsi AES-256 lalu disimpan di AsyncStorage, sedangkan kunci enkripsinya
 * disimpan di SecureStore (Keychain/Keystore). SecureStore sendiri tidak cocok untuk
 * nilai besar, jadi hanya kuncinya yang ditaruh di sana.
 */
class LargeSecureStore {
  private secureKey(key: string) {
    // SecureStore hanya menerima huruf, angka, ".", "-", "_".
    return key.replace(/[^A-Za-z0-9._-]/g, "_");
  }

  private async encrypt(key: string, value: string) {
    const encryptionKey = Crypto.getRandomBytes(256 / 8);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(this.secureKey(key), aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(this.secureKey(key));
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await this.decrypt(key, encrypted);
    } catch {
      return null; // kunci hilang/rusak → anggap belum login
    }
  }

  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, await this.encrypt(key, value));
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(this.secureKey(key));
  }
}

/** Web (hanya untuk pratinjau dev): SecureStore tidak ada, pakai AsyncStorage biasa; saat render server tidak ada storage. */
const webStorage = {
  getItem: (key: string) => (typeof window === "undefined" ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    typeof window === "undefined" ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => (typeof window === "undefined" ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

// Kalau env belum diisi, client tetap dibuat dengan nilai dummy agar app tidak crash;
// layar "konfigurasi belum lengkap" (lihat auth.tsx) mencegah client ini dipakai.
export const supabase: SupabaseClient = createClient(
  configError ? "https://belum-diisi.supabase.co" : SUPABASE_URL,
  configError ? "belum-diisi" : SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: Platform.OS === "web" ? webStorage : new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Perpanjang token otomatis hanya saat app sedang dibuka (hemat baterai), sesuai panduan Expo.
if (Platform.OS !== "web" && !configError) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

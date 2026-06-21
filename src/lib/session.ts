import { cookies } from "next/headers";
import crypto from "crypto";

// Sistem sesi sederhana berbasis cookie yang ditandatangani (HMAC),
// tanpa dependency tambahan seperti JWT library.
// Cocok untuk skala kecil-menengah seperti Glori Barbershop.

// PENTING — keamanan sesi bergantung penuh pada kerahasiaan SESSION_SECRET.
// Sebelumnya ada fallback string tetap ("dev-secret-change-me") yang dipakai
// diam-diam kalau env var belum diset — kalau itu sampai terjadi di
// production (misal lupa konfigurasi di Vercel), siapa pun yang tahu
// fallback ini (termasuk dari membaca kode sumber ini) bisa memalsukan
// cookie sesi APA SAJA — login sebagai admin, barber, atau pelanggan
// manapun tanpa password. Sekarang: di production, SESSION_SECRET WAJIB
// diset lewat environment variable atau aplikasi sengaja gagal jalan
// (lebih baik error jelas saat deploy daripada diam-diam tidak aman).
// Di development boleh pakai fallback supaya tetap mudah dijalankan lokal.
const SECRET = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET belum diset di environment variables. " +
        "Tanpa ini, sesi login tidak aman — set SESSION_SECRET (string acak panjang) " +
        "di pengaturan environment variable hosting kamu (mis. Vercel) sebelum deploy."
    );
  }
  return "dev-secret-change-me";
})();

export type SessionPayload = {
  type: "user" | "staff";
  id: string;
  name: string;
  role?: "admin" | "barber"; // hanya untuk staff
};

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function encode(payload: SessionPayload) {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json).toString("base64url");
  const signature = sign(base64);
  return `${base64}.${signature}`;
}

function decode(token: string): SessionPayload | null {
  const [base64, signature] = token.split(".");
  if (!base64 || !signature) return null;
  if (sign(base64) !== signature) return null; // tanda tangan tidak valid -> tolak
  try {
    const json = Buffer.from(base64, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

const COOKIE_USER = "glori_user_session";
const COOKIE_STAFF = "glori_staff_session";

export async function setUserSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(COOKIE_USER, encode(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 hari
  });
}

export async function setStaffSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(COOKIE_STAFF, encode(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 hari
  });
}

export async function getUserSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_USER)?.value;
  if (!token) return null;
  return decode(token);
}

export async function getStaffSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_STAFF)?.value;
  if (!token) return null;
  return decode(token);
}

export async function clearUserSession() {
  const store = await cookies();
  store.delete(COOKIE_USER);
}

export async function clearStaffSession() {
  const store = await cookies();
  store.delete(COOKIE_STAFF);
}

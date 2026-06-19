import { cookies } from "next/headers";
import crypto from "crypto";

// Sistem sesi sederhana berbasis cookie yang ditandatangani (HMAC),
// tanpa dependency tambahan seperti JWT library.
// Cocok untuk skala kecil-menengah seperti Glori Barbershop.

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

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

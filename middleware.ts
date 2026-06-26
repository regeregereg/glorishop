import { NextRequest, NextResponse } from "next/server";

const ONBOARDING_COOKIE = "glori_onboarded";
const COOKIE_STAFF      = "glori_staff_session";

function todayKey(): string {
  // YYYY-MM-DD WIB (UTC+7) — supaya tidak reset tengah malam UTC
  // yang di Indonesia masih jam 07:00 pagi.
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Baca role dari cookie staff TANPA verifikasi HMAC (Edge Runtime tidak
 * punya Node crypto). Decode base64url saja untuk baca payload.
 * Verifikasi HMAC tetap terjadi di server saat layout protected dirender.
 */
function getStaffRoleFromCookie(request: NextRequest): "admin" | "barber" | null {
  const token = request.cookies.get(COOKIE_STAFF)?.value;
  if (!token) return null;
  try {
    const [base64] = token.split(".");
    if (!base64) return null;
    const json = Buffer.from(base64, "base64url").toString("utf-8");
    const payload = JSON.parse(json);
    if (payload?.type === "staff" && (payload.role === "admin" || payload.role === "barber")) {
      return payload.role;
    }
    return null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Hanya intercept "/" ──────────────────────────────────────────────────
  // Kalau bukan "/", biarkan jalan normal (layout protected sudah punya
  // guard server-side masing-masing).
  if (pathname !== "/") return NextResponse.next();

  // ── Cek apakah ada sesi staff aktif ─────────────────────────────────────
  // Kalau barber/admin buka app dari shortcut/home screen dan langsung
  // mendarat di "/", redirect langsung ke dashboard mereka tanpa paksa
  // lewat onboarding — mereka sudah tahu app ini, tidak perlu diperkenalkan
  // lagi setiap hari.
  const staffRole = getStaffRoleFromCookie(request);
  if (staffRole === "admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }
  if (staffRole === "barber") {
    return NextResponse.redirect(new URL("/barber/dashboard", request.url));
  }

  // ── Onboarding untuk customer biasa ─────────────────────────────────────
  const lastSeen = request.cookies.get(ONBOARDING_COOKIE)?.value;
  if (lastSeen !== todayKey()) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};

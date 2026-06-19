import { NextRequest, NextResponse } from "next/server";

// Sebelum masuk ke beranda aplikasi, pengguna diarahkan dulu ke layar
// perkenalan "/onboarding" — tapi cuma SEKALI PER HARI. Cookie
// "glori_onboarded" isinya tanggal terakhir kali onboarding dilewati
// (format YYYY-MM-DD). Begitu tanggalnya beda dari hari ini, onboarding
// akan tampil lagi.
const ONBOARDING_COOKIE = "glori_onboarded";

function todayKey(): string {
  // YYYY-MM-DD berdasarkan waktu server.
  return new Date().toISOString().slice(0, 10);
}

export function middleware(request: NextRequest) {
  const lastSeen = request.cookies.get(ONBOARDING_COOKIE)?.value;

  if (lastSeen !== todayKey()) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Hanya cegat akses ke halaman utama "/" — link langsung ke halaman lain
// (mis. dari WhatsApp) tetap jalan normal tanpa dipaksa lewat onboarding.
export const config = {
  matcher: "/",
};

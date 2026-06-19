import { NextRequest, NextResponse } from "next/server";

// Sebelum masuk ke beranda aplikasi, pengunjung baru (belum pernah lihat
// onboarding) diarahkan dulu ke layar perkenalan "/onboarding".
// Setelah itu cookie "glori_onboarded" disimpan supaya tidak diulang lagi.
const ONBOARDING_COOKIE = "glori_onboarded";

export function middleware(request: NextRequest) {
  const hasSeenOnboarding = request.cookies.get(ONBOARDING_COOKIE);

  if (!hasSeenOnboarding) {
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

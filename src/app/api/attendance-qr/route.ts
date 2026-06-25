import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/session";
import { generateQrToken, verifyQrToken, secondsUntilNextWindow, QR_WINDOW_SECONDS, checkGpsRadius, GpsCoords } from "@/lib/attendance-qr";
import { createAdminClient } from "@/lib/supabase/admin";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── GET /api/attendance-qr ──────────────────────────────────────────────────
export async function GET() {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const token = generateQrToken(0);
  const remaining = secondsUntilNextWindow();
  const qrPayload = `GLORI-ABSEN:${token}`;

  const svg = await QRCode.toString(qrPayload, {
    type: "svg",
    width: 280,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });

  return NextResponse.json(
    { token, svg, remaining, windowSeconds: QR_WINDOW_SECONDS },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
  );
}

// ─── POST /api/attendance-qr ─────────────────────────────────────────────────
// body: { token: string, action: "clock_in"|"clock_out", lat: number, lng: number }
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== "barber") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json();
  const rawToken: string = body.token ?? "";
  const action: "clock_in" | "clock_out" = body.action;

  if (!["clock_in", "clock_out"].includes(action)) {
    return NextResponse.json({ error: "Action tidak valid." }, { status: 400 });
  }

  // ─── Validasi GPS ─────────────────────────────────────────────────────────
  const lat = body.lat as number | undefined;
  const lng = body.lng as number | undefined;

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Lokasi GPS diperlukan untuk absen. Pastikan izin lokasi diaktifkan di browser." },
      { status: 400 }
    );
  }

  const gps = checkGpsRadius({ lat, lng } as GpsCoords);
  if (!gps.ok) {
    return NextResponse.json({ error: gps.reason }, { status: 400 });
  }

  // ─── Verifikasi token QR ──────────────────────────────────────────────────
  const tokenOnly = rawToken.startsWith("GLORI-ABSEN:")
    ? rawToken.replace("GLORI-ABSEN:", "")
    : rawToken;

  if (!verifyQrToken(tokenOnly)) {
    return NextResponse.json(
      { error: "QR Code tidak valid atau sudah kedaluwarsa. Minta admin tampilkan QR terbaru." },
      { status: 400 }
    );
  }

  // ─── Simpan absensi ───────────────────────────────────────────────────────
  const supabase = createAdminClient();
  const staffId = session.id;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", staffId)
    .eq("date", today)
    .maybeSingle();

  if (action === "clock_in") {
    if (existing?.clock_in) {
      return NextResponse.json({ error: "Sudah absen masuk hari ini." }, { status: 400 });
    }
    await supabase.rpc("auto_close_attendance");

    let data, error;
    if (existing) {
      ({ data, error } = await supabase
        .from("attendance")
        .update({ clock_in: now })
        .eq("id", existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from("attendance")
        .insert({ staff_id: staffId, date: today, clock_in: now })
        .select()
        .single());
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendance: data, message: "Absen masuk berhasil!" });
  }

  // clock_out
  if (!existing?.clock_in) {
    return NextResponse.json({ error: "Belum absen masuk hari ini." }, { status: 400 });
  }
  if (existing?.clock_out) {
    return NextResponse.json({ error: "Sudah absen pulang hari ini." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("attendance")
    .update({ clock_out: now })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data, message: "Absen pulang berhasil!" });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/attendance?staffId=xxx&date=YYYY-MM-DD
// Kalau staffId tidak diisi → pakai session sendiri (barber/admin absen diri sendiri)
// Kalau staffId diisi → hanya admin yang boleh (lihat rekap staff lain)
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staffId") ?? session.id;
  const date = searchParams.get("date"); // opsional; kalau kosong → hari ini

  // Hanya admin yang boleh lihat rekap staff lain
  if (staffId !== session.id && session.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();

  if (date) {
    // Ambil satu hari spesifik
    const { data, error } = await supabase
      .from("attendance")
      .select("*, staff:staff(id, name, role)")
      .eq("staff_id", staffId)
      .eq("date", date)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ attendance: data });
  }

  // Tanpa date → hari ini (default)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const { data, error } = await supabase
    .from("attendance")
    .select("*, staff:staff(id, name, role)")
    .eq("staff_id", staffId)
    .eq("date", today)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ attendance: data, today });
}

// POST /api/attendance
// body: { action: "clock_in" | "clock_out", staffId?: string (admin only) }
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json();
  const action: "clock_in" | "clock_out" = body.action;

  if (!["clock_in", "clock_out"].includes(action)) {
    return NextResponse.json({ error: "Action tidak valid." }, { status: 400 });
  }

  // staffId: admin bisa absenkan staff lain, barber hanya diri sendiri
  const staffId: string = body.staffId ?? session.id;
  if (staffId !== session.id && session.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const now = new Date().toISOString();

  // Cek apakah sudah ada record hari ini
  const { data: existing } = await supabase
    .from("attendance")
    .select("*")
    .eq("staff_id", staffId)
    .eq("date", today)
    .maybeSingle();

  if (action === "clock_in") {
    if (existing?.clock_in) {
      return NextResponse.json(
        { error: "Sudah absen masuk hari ini." },
        { status: 400 }
      );
    }

    // Sebelum buat record baru, tutup dulu absensi kemarin yang belum ditutup
    await supabase.rpc("auto_close_attendance");

    if (existing) {
      // Record sudah ada tapi clock_in kosong (edge case — admin buat manual)
      const { data, error } = await supabase
        .from("attendance")
        .update({ clock_in: now })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ attendance: data });
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert({ staff_id: staffId, date: today, clock_in: now })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ attendance: data });
  }

  // action === "clock_out"
  if (!existing?.clock_in) {
    return NextResponse.json(
      { error: "Belum absen masuk hari ini." },
      { status: 400 }
    );
  }
  if (existing?.clock_out) {
    return NextResponse.json(
      { error: "Sudah absen pulang hari ini." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("attendance")
    .update({ clock_out: now })
    .eq("id", existing.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}

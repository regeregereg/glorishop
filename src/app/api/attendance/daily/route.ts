import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/attendance/daily?date=YYYY-MM-DD
// Rekap absensi SEMUA staff aktif untuk satu hari (default: hari ini)
// Hanya admin yang boleh akses
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const date = searchParams.get("date") ?? today;

  // Ambil semua staff aktif
  const { data: staffList, error: staffError } = await supabase
    .from("staff")
    .select("id, name, role, photo_url")
    .eq("is_active", true)
    .order("name");

  if (staffError) {
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  // Ambil semua record attendance hari itu
  const { data: attendanceList, error: attError } = await supabase
    .from("attendance")
    .select("*")
    .eq("date", date);

  if (attError) {
    return NextResponse.json({ error: attError.message }, { status: 500 });
  }

  // Gabungkan: setiap staff dapat record-nya (atau null kalau belum absen)
  const result = (staffList ?? []).map((staff) => {
    const att = (attendanceList ?? []).find((a) => a.staff_id === staff.id) ?? null;
    return { ...staff, attendance: att };
  });

  return NextResponse.json({ date, staff: result, today });
}

// PATCH /api/attendance/daily — admin edit record absensi (misal: isi note, tutup clock_out manual)
export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json();
  const { attendanceId, clock_in, clock_out, note } = body;

  if (!attendanceId) {
    return NextResponse.json({ error: "attendanceId wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updates: Record<string, string | null> = {};
  if (clock_in  !== undefined) updates.clock_in  = clock_in;
  if (clock_out !== undefined) updates.clock_out = clock_out;
  if (note      !== undefined) updates.note      = note;

  const { data, error } = await supabase
    .from("attendance")
    .update(updates)
    .eq("id", attendanceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// DELETE /api/slots/clear-break
// Alat bantu RETROAKTIF: menghapus slot yang jatuh di jam istirahat barber
// untuk SATU tanggal tertentu, khusus untuk slot yang masih kosong
// (is_available = true). Ini untuk membereskan slot yang sudah kadung
// digenerate SEBELUM jam istirahat diatur di halaman Kelola Barber —
// generate slot yang baru sudah otomatis melubangi jam ini sendiri, jadi
// tool ini hanya perlu dipakai sekali untuk beres-beres slot lama.
//
// Slot yang SUDAH DIBOOKING (is_available = false) di jam istirahat ini
// TIDAK dihapus — itu perlu ditangani manual (hubungi pelanggan untuk
// reschedule) lewat halaman Antrian, persis seperti perilaku
// /api/slots/delete-day untuk slot yang sudah dibooking.
//
// Body: { barber_id, date, break_start, break_end }
export async function DELETE(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const { barber_id, date, break_start, break_end } = body as {
    barber_id: string;
    date: string;
    break_start: string;
    break_end: string;
  };

  if (!barber_id || !date || !break_start || !break_end) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Hitung dulu berapa slot yang SUDAH DIBOOKING di jam istirahat ini —
  // dilaporkan ke admin supaya tahu ada berapa pelanggan yang perlu
  // dihubungi untuk reschedule, walau tidak ikut dihapus.
  const { count: bookedCount } = await supabase
    .from("slots")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", barber_id)
    .eq("date", date)
    .eq("is_available", false)
    .gte("start_time", break_start)
    .lt("start_time", break_end);

  const { data: deleted, error } = await supabase
    .from("slots")
    .delete()
    .eq("barber_id", barber_id)
    .eq("date", date)
    .eq("is_available", true)
    .gte("start_time", break_start)
    .lt("start_time", break_end)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deletedCount: deleted?.length ?? 0,
    bookedCount: bookedCount ?? 0,
  });
}

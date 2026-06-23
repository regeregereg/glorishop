import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// DELETE /api/slots/delete-day
// Hapus SEMUA slot untuk barber + tanggal tertentu (menjadikannya hari libur).
// Slot yang sudah dibooking (is_available = false) TIDAK dihapus — harus
// cancel booking dulu lewat halaman antrian sebelum bisa dihapus.
// Body: { barber_id, date }
export async function DELETE(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const { barber_id, date } = body as { barber_id: string; date: string };

  if (!barber_id || !date) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Cek apakah ada slot yang sedang dibooking (is_available = false)
  const { count: bookedCount } = await supabase
    .from("slots")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", barber_id)
    .eq("date", date)
    .eq("is_available", false);

  if ((bookedCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `Tidak bisa hapus — ada ${bookedCount} slot yang sudah dibooking pelanggan. Batalkan booking lebih dulu di halaman Antrian.`,
        bookedCount,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("slots")
    .delete()
    .eq("barber_id", barber_id)
    .eq("date", date)
    .eq("is_available", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date });
}

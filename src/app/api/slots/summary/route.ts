import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// GET /api/slots/summary?barberId=xxx&year=2026&month=7
// Mengembalikan status per hari dalam satu bulan untuk satu barber.
// Dipakai untuk kalender di halaman admin Kelola Slot.
//
// Response per tanggal:
//   "open"   — ada slot tersedia (is_available = true)
//   "full"   — semua slot terisi booking (is_available = false, ada ≥1 slot)
//   "empty"  — belum ada slot sama sekali
export async function GET(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month")); // 1-based

  if (!barberId || !year || !month) {
    return NextResponse.json({ error: "Parameter tidak lengkap." }, { status: 400 });
  }

  // Range tanggal untuk bulan ini (format YYYY-MM-DD)
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0); // hari terakhir bulan ini
  const lastDay = lastDayDate.toISOString().slice(0, 10);

  const supabase = createAdminClient();

  // Ambil semua slot bulan ini untuk barber ini — hanya kolom yang diperlukan
  const { data, error } = await supabase
    .from("slots")
    .select("date, is_available")
    .eq("barber_id", barberId)
    .gte("date", firstDay)
    .lte("date", lastDay);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agregasi per tanggal
  const map = new Map<string, { total: number; available: number }>();
  for (const row of data ?? []) {
    const d = row.date as string;
    const prev = map.get(d) ?? { total: 0, available: 0 };
    map.set(d, {
      total: prev.total + 1,
      available: prev.available + (row.is_available ? 1 : 0),
    });
  }

  // Semua hari dalam bulan
  const daysInMonth = lastDayDate.getDate();
  const summary: Record<string, "open" | "full" | "empty"> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const stat = map.get(dateStr);
    if (!stat) {
      summary[dateStr] = "empty";
    } else if (stat.available > 0) {
      summary[dateStr] = "open";
    } else {
      summary[dateStr] = "full";
    }
  }

  return NextResponse.json({ summary, year, month, barberId });
}

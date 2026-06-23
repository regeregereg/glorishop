import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/slots/availability-calendar?year=2026&month=7
//
// Endpoint PUBLIK (tanpa session) — dipakai oleh kalender ketersediaan
// di Home. Beda dari /api/slots/summary (admin-only, per satu barber):
// di sini semua barber DIGABUNG, karena tujuannya cuma menjawab
// pertanyaan paling sederhana untuk pelanggan awam: "tanggal ini ada
// slot kosong atau tidak?" — tanpa perlu tahu/pilih nama barber dulu.
//
// Status per tanggal:
//   "available" — ada minimal satu slot kosong, dari barber manapun
//   "full"      — sudah ada slot dibuat, tapi semua sudah terisi/penuh
//   "none"      — belum ada slot dibuat sama sekali untuk tanggal itu
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month")); // 1-based

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parameter year/month tidak valid." }, { status: 400 });
  }

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDayDate = new Date(year, month, 0); // hari terakhir bulan ini
  const lastDay = lastDayDate.toISOString().slice(0, 10);

  const supabase = createAdminClient();

  // Hanya ambil kolom yang perlu — tanggal & status tersedia, lintas semua barber
  const { data, error } = await supabase
    .from("slots")
    .select("date, is_available")
    .gte("date", firstDay)
    .lte("date", lastDay);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agregasi per tanggal — gabungan SEMUA barber. Cukup satu slot kosong
  // dari barber manapun untuk membuat tanggal itu dianggap "available".
  const map = new Map<string, { total: number; available: number }>();
  for (const row of data ?? []) {
    const d = row.date as string;
    const prev = map.get(d) ?? { total: 0, available: 0 };
    map.set(d, {
      total: prev.total + 1,
      available: prev.available + (row.is_available ? 1 : 0),
    });
  }

  const daysInMonth = lastDayDate.getDate();
  const summary: Record<string, "available" | "full" | "none"> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const stat = map.get(dateStr);
    if (!stat) {
      summary[dateStr] = "none";
    } else if (stat.available > 0) {
      summary[dateStr] = "available";
    } else {
      summary[dateStr] = "full";
    }
  }

  return NextResponse.json({ summary, year, month });
}

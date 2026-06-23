import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// POST /api/slots/bulk
// Generate slot untuk BANYAK tanggal sekaligus dalam satu request.
// Body: { barber_id, dates: string[], start_time, end_time, interval_min }
export async function POST(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const { barber_id, dates, start_time, end_time, interval_min } = body as {
    barber_id: string;
    dates: string[];          // array YYYY-MM-DD
    start_time: string;       // "09:00"
    end_time: string;         // "18:00"
    interval_min: number;
  };

  if (
    !barber_id ||
    !Array.isArray(dates) ||
    dates.length === 0 ||
    !start_time ||
    !end_time ||
    !interval_min
  ) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  // Hitung time ranges sekali, dipakai untuk semua tanggal
  function timeToMin(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }
  const ranges: { start_time: string; end_time: string }[] = [];
  let cur = timeToMin(start_time);
  const endMin = timeToMin(end_time);
  while (cur + interval_min <= endMin) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const s = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`;
    const e = `${pad(Math.floor((cur + interval_min) / 60))}:${pad((cur + interval_min) % 60)}`;
    ranges.push({ start_time: s, end_time: e });
    cur += interval_min;
  }

  // Flatten: satu row per (tanggal × slot)
  const rows = dates.flatMap((date) =>
    ranges.map((r) => ({
      barber_id,
      date,
      start_time: r.start_time,
      end_time: r.end_time,
      is_available: true,
    }))
  );

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("slots")
    .upsert(rows, { onConflict: "barber_id,date,start_time", ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    datesCount: dates.length,
    slotsPerDay: ranges.length,
    totalInserted: rows.length,
  });
}

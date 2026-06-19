import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// GET /api/slots?barberId=xxx&date=YYYY-MM-DD
// GET /api/slots?date=YYYY-MM-DD (semua barber pada tanggal itu)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  const supabase = createAdminClient();
  let query = supabase.from("slots").select("*").order("start_time", { ascending: true });

  if (barberId) query = query.eq("barber_id", barberId);
  if (date) query = query.eq("date", date);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ slots: data });
}

// POST: admin generate slot baru (satu atau banyak sekaligus)
export async function POST(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const { barber_id, date, slots } = body as {
    barber_id: string;
    date: string;
    slots: { start_time: string; end_time: string }[];
  };

  if (!barber_id || !date || !Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const rows = slots.map((s) => ({
    barber_id,
    date,
    start_time: s.start_time,
    end_time: s.end_time,
    is_available: true,
  }));

  const { error: upsertError } = await supabase
    .from("slots")
    .upsert(rows, { onConflict: "barber_id,date,start_time", ignoreDuplicates: true });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Ambil ulang semua slot untuk barber+tanggal ini, karena upsert dengan
  // ignoreDuplicates tidak mengembalikan baris yang sudah ada sebelumnya.
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("barber_id", barber_id)
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ slots: data });
}

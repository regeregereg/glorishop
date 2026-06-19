import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";

// GET /api/bookings?userId=xxx  -> riwayat booking user
// GET /api/bookings?date=YYYY-MM-DD  -> semua booking di tanggal itu (admin/barber)
// GET /api/bookings?barberId=xxx&date=YYYY-MM-DD -> antrian barber tertentu
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const date = searchParams.get("date");
  const barberId = searchParams.get("barberId");
  const status = searchParams.get("status");

  const supabase = createAdminClient();
  let query = supabase
    .from("bookings")
    .select(
      "*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone)"
    )
    .order("created_at", { ascending: false });

  if (userId) query = query.eq("user_id", userId);
  if (barberId) query = query.eq("barber_id", barberId);
  if (status) query = query.eq("status", status);
  if (date) query = query.eq("slot.date", date);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter manual untuk date karena filter pada relasi nested tidak selalu didukung
  const filtered = date ? data.filter((b) => b.slot?.date === date) : data;

  return NextResponse.json({ bookings: filtered });
}

// POST: buat booking baru. Aman dari race condition karena slot dikunci
// dengan conditional update (is_available: true -> false) sebelum insert booking.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userSession = await getUserSession();
  const staffSession = await getStaffSession();

  const { slot_id, service_id, barber_id, notes, walkin_name, walkin_phone } = body;

  if (!slot_id || !service_id) {
    return NextResponse.json({ error: "Layanan dan slot wajib dipilih." }, { status: 400 });
  }

  const isAdminBooking = staffSession?.role === "admin" && body.created_by_admin;

  if (!userSession && !isAdminBooking) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Step 1: kunci slot secara atomik. Update hanya berhasil jika is_available masih true.
  const { data: lockedSlot, error: lockError } = await supabase
    .from("slots")
    .update({ is_available: false })
    .eq("id", slot_id)
    .eq("is_available", true)
    .select("*")
    .maybeSingle();

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  if (!lockedSlot) {
    return NextResponse.json(
      { error: "Slot ini baru saja dibooking orang lain. Silakan pilih slot lain." },
      { status: 409 }
    );
  }

  // Step 2: insert booking. Jika gagal, kembalikan slot ke available (rollback manual).
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      user_id: userSession?.id ?? null,
      barber_id: barber_id ?? lockedSlot.barber_id,
      service_id,
      slot_id,
      notes: notes ?? null,
      walkin_name: isAdminBooking ? walkin_name : null,
      walkin_phone: isAdminBooking ? walkin_phone : null,
      created_by_admin: !!isAdminBooking,
      status: "PENDING",
    })
    .select("*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*)")
    .single();

  if (bookingError) {
    // rollback: buka kembali slot
    await supabase.from("slots").update({ is_available: true }).eq("id", slot_id);
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Notifikasi ke admin (in-app log; pengiriman WA aktual ditangani modul Fonnte/Wablas terpisah)
  await supabase.from("notifications").insert({
    type: "booking_baru",
    message: `Ada booking baru dari ${booking.walkin_name ?? userSession?.name ?? "pelanggan"} untuk ${booking.service?.name ?? "layanan"}.`,
  });

  return NextResponse.json({ booking });
}

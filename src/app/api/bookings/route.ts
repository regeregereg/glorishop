import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";
import { getServiceBasePrice, calculatePaymentAmount, getPaymentExpiryDate } from "@/lib/payment";
import { PaymentType } from "@/types";

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

  // Lazy expiry check: booking yang masih WAITING_PAYMENT dan sudah lewat
  // waktu pembayarannya (payments.expires_at) otomatis dibatalkan di sini,
  // setiap kali ada yang membuka daftar booking. Tidak butuh cron job.
  await expireOverduePayments(supabase);

  let query = supabase
    .from("bookings")
    .select(
      "*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone), payment:payments(*)"
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

  // Supabase mengembalikan relasi 1:1 sebagai array; ratakan jadi objek tunggal.
  const normalized = data.map((b) => ({
    ...b,
    payment: Array.isArray(b.payment) ? b.payment[0] ?? null : b.payment,
  }));

  // Filter manual untuk date karena filter pada relasi nested tidak selalu didukung
  const filtered = date ? normalized.filter((b) => b.slot?.date === date) : normalized;

  return NextResponse.json({ bookings: filtered });
}

// Cari semua booking WAITING_PAYMENT yang payment-nya sudah expired,
// batalkan booking-nya (trigger di DB otomatis melepas slot) dan tandai
// payment-nya REJECTED supaya tidak terus-terusan dicek ulang.
async function expireOverduePayments(supabase: ReturnType<typeof createAdminClient>) {
  const nowIso = new Date().toISOString();

  const { data: overdue } = await supabase
    .from("payments")
    .select("id, booking_id, expires_at")
    .eq("status", "WAITING_PROOF")
    .lt("expires_at", nowIso);

  if (!overdue || overdue.length === 0) return;

  const bookingIds = overdue.map((p) => p.booking_id);
  const paymentIds = overdue.map((p) => p.id);

  await supabase
    .from("bookings")
    .update({ status: "CANCELLED_ADMIN" })
    .in("id", bookingIds)
    .eq("status", "WAITING_PAYMENT");

  await supabase
    .from("payments")
    .update({ status: "REJECTED", rejection_reason: "Waktu pembayaran habis (30 menit)." })
    .in("id", paymentIds);
}

// POST: buat booking baru. Aman dari race condition karena slot dikunci
// dengan conditional update (is_available: true -> false) sebelum insert booking.
//
// Untuk booking dari pelanggan (bukan walk-in admin), booking dibuat dengan
// status WAITING_PAYMENT dan langsung disertai baris "payments" yang berisi
// nominal yang harus dibayar (DP atau Lunas, sesuai payment_type dari body).
// Booking walk-in yang diinput admin langsung (created_by_admin) tidak butuh
// alur pembayaran online ini karena dianggap sudah dibayar/diatur di tempat.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userSession = await getUserSession();
  const staffSession = await getStaffSession();

  const { slot_id, service_id, barber_id, notes, walkin_name, walkin_phone } = body;
  const paymentType: PaymentType = body.payment_type === "FULL" ? "FULL" : "DP";

  if (!slot_id || !service_id) {
    return NextResponse.json({ error: "Layanan dan slot wajib dipilih." }, { status: 400 });
  }

  const isAdminBooking = staffSession?.role === "admin" && body.created_by_admin;

  if (!userSession && !isAdminBooking) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Ambil data layanan dulu untuk hitung nominal pembayaran (kalau bukan walk-in admin).
  let basePrice = 0;
  if (!isAdminBooking) {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("price, price_min")
      .eq("id", service_id)
      .single();
    if (serviceError || !service) {
      return NextResponse.json({ error: "Layanan tidak ditemukan." }, { status: 404 });
    }
    basePrice = getServiceBasePrice(service);
  }

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
      status: isAdminBooking ? "PENDING" : "WAITING_PAYMENT",
    })
    .select("*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*)")
    .single();

  if (bookingError) {
    // rollback: buka kembali slot
    await supabase.from("slots").update({ is_available: true }).eq("id", slot_id);
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Step 3: buat baris payment kalau ini booking pelanggan (bukan walk-in admin).
  let payment = null;
  if (!isAdminBooking) {
    const amount = calculatePaymentAmount(basePrice, paymentType);
    const { data: paymentRow, error: paymentError } = await supabase
      .from("payments")
      .insert({
        booking_id: booking.id,
        payment_type: paymentType,
        amount,
        service_price: basePrice,
        status: "WAITING_PROOF",
        expires_at: getPaymentExpiryDate().toISOString(),
      })
      .select("*")
      .single();

    if (paymentError) {
      // rollback: hapus booking & buka kembali slot
      await supabase.from("bookings").delete().eq("id", booking.id);
      await supabase.from("slots").update({ is_available: true }).eq("id", slot_id);
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }
    payment = paymentRow;
  }

  // Notifikasi ke admin (in-app log; pengiriman WA aktual ditangani modul Fonnte/Wablas terpisah)
  await supabase.from("notifications").insert({
    type: "booking_baru",
    message: `Ada booking baru dari ${booking.walkin_name ?? userSession?.name ?? "pelanggan"} untuk ${booking.service?.name ?? "layanan"}.`,
  });

  return NextResponse.json({ booking: { ...booking, payment } });
}

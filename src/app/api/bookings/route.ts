import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";
import { getServicesBasePrice, calculatePaymentAmount, getPaymentExpiryDate } from "@/lib/payment";
import { PaymentType, Service } from "@/types";

// Cari slot-slot BERURUTAN milik barber yang sama, di tanggal yang sama,
// tanpa jeda waktu (end_time slot ke-N == start_time slot ke-N+1), dimulai
// dari slot yang dipilih pelanggan, sampai total durasinya mencukupi
// totalDurationMin. Dipakai untuk booking multi-layanan yang totalnya lebih
// panjang dari satu slot saja (mis. Haircut 30 menit + Creambath 45 menit
// = butuh 75 menit, kalau slot per-blok cuma 30 menit maka perlu 3 slot).
function findConsecutiveSlots<
  T extends { id: string; barber_id: string; date: string; start_time: string; end_time: string; is_available: boolean }
>(allSlotsForBarberDate: T[], startSlotId: string, totalDurationMin: number): T[] | null {
  const sorted = [...allSlotsForBarberDate].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const startIdx = sorted.findIndex((s) => s.id === startSlotId);
  if (startIdx === -1) return null;

  const chosen: T[] = [sorted[startIdx]];
  let accumulatedMin = timeToMinutes(sorted[startIdx].end_time) - timeToMinutes(sorted[startIdx].start_time);

  let i = startIdx;
  while (accumulatedMin < totalDurationMin) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!next) return null; // kehabisan slot berikutnya
    if (!next.is_available) return null; // slot berikutnya sudah dibooking orang lain
    if (next.start_time !== current.end_time) return null; // ada jeda waktu, tidak berurutan
    chosen.push(next);
    accumulatedMin += timeToMinutes(next.end_time) - timeToMinutes(next.start_time);
    i += 1;
  }

  return chosen;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

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
      "*, service:services(*), services:booking_services(*, service:services(*)), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone), payment:payments(*)"
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
  // Untuk "services" (booking_services), urutkan sesuai sort_order supaya
  // tampilannya konsisten dengan urutan pelanggan memilih.
  const normalized = data.map((b) => ({
    ...b,
    payment: Array.isArray(b.payment) ? b.payment[0] ?? null : b.payment,
    services: Array.isArray(b.services)
      ? [...b.services].sort((a, c) => a.sort_order - c.sort_order)
      : [],
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
// Mendukung MULTI-LAYANAN: body.service_ids bisa berisi beberapa id layanan
// sekaligus (mis. Haircut + Creambath dalam satu janji temu). body.service_id
// (tunggal) masih diterima untuk kompatibilitas mundur dengan kode lama —
// kalau dikirim, otomatis diperlakukan sebagai array berisi 1 elemen.
//
// Karena slot waktu dibuat per-blok (mis. tiap 30 menit), booking dengan
// total durasi layanan lebih panjang dari satu slot akan mengunci BEBERAPA
// slot berurutan milik barber yang sama, dimulai dari slot_id yang dipilih
// pelanggan, sampai durasinya tercukupi.
//
// Untuk booking dari pelanggan (bukan walk-in admin), booking dibuat dengan
// status WAITING_PAYMENT dan langsung disertai baris "payments" yang berisi
// nominal yang harus dibayar (DP atau Lunas, sesuai payment_type dari body),
// dihitung dari TOTAL harga semua layanan yang dipilih.
// Booking walk-in yang diinput admin langsung (created_by_admin) tidak butuh
// alur pembayaran online ini karena dianggap sudah dibayar/diatur di tempat.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userSession = await getUserSession();
  const staffSession = await getStaffSession();

  const { slot_id, barber_id, notes, walkin_name, walkin_phone } = body;
  const paymentType: PaymentType = body.payment_type === "FULL" ? "FULL" : "DP";

  // Terima service_ids (array, cara baru/multi-layanan) atau service_id
  // (tunggal, cara lama) — keduanya dinormalisasi jadi satu array di sini.
  const rawServiceIds: unknown = body.service_ids ?? (body.service_id ? [body.service_id] : []);
  const serviceIds: string[] = Array.isArray(rawServiceIds)
    ? Array.from(new Set(rawServiceIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];

  if (!slot_id || serviceIds.length === 0) {
    return NextResponse.json({ error: "Minimal satu layanan dan slot wajib dipilih." }, { status: 400 });
  }

  const isAdminBooking = staffSession?.role === "admin" && body.created_by_admin;

  if (!userSession && !isAdminBooking) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Ambil data semua layanan yang dipilih sekaligus, untuk hitung total
  // durasi (jumlah semua duration_minutes) dan total harga.
  const { data: selectedServices, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .in("id", serviceIds);

  if (serviceError || !selectedServices || selectedServices.length !== serviceIds.length) {
    return NextResponse.json({ error: "Salah satu layanan yang dipilih tidak ditemukan." }, { status: 404 });
  }

  // Urutkan sesuai urutan dipilih pelanggan (serviceIds), bukan urutan dari DB.
  const orderedServices: Service[] = serviceIds
    .map((id) => selectedServices.find((s) => s.id === id))
    .filter((s): s is Service => !!s);

  const totalDurationMin = orderedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const basePrice = isAdminBooking ? 0 : getServicesBasePrice(orderedServices);

  // Step 1: cari slot dasar yang dipilih pelanggan + barber-nya.
  const { data: baseSlot, error: baseSlotError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", slot_id)
    .maybeSingle();

  if (baseSlotError || !baseSlot) {
    return NextResponse.json({ error: "Slot tidak ditemukan." }, { status: 404 });
  }
  if (!baseSlot.is_available) {
    return NextResponse.json(
      { error: "Slot ini baru saja dibooking orang lain. Silakan pilih slot lain." },
      { status: 409 }
    );
  }

  // Step 2: cari slot-slot berurutan (barber & tanggal sama) yang cukup
  // untuk menampung total durasi semua layanan yang dipilih.
  const { data: slotsForDay, error: slotsForDayError } = await supabase
    .from("slots")
    .select("*")
    .eq("barber_id", baseSlot.barber_id)
    .eq("date", baseSlot.date);

  if (slotsForDayError || !slotsForDay) {
    return NextResponse.json({ error: "Gagal memeriksa ketersediaan slot." }, { status: 500 });
  }

  const neededSlots = findConsecutiveSlots(slotsForDay, slot_id, totalDurationMin);
  if (!neededSlots) {
    return NextResponse.json(
      {
        error:
          "Slot waktu berurutan tidak cukup untuk total durasi semua layanan yang dipilih. Coba pilih waktu lain atau kurangi jumlah layanan.",
      },
      { status: 409 }
    );
  }
  const neededSlotIds = neededSlots.map((s) => s.id);

  // Step 3: kunci semua slot yang dibutuhkan secara atomik. Update hanya
  // berhasil untuk baris yang is_available masih true; kalau jumlah baris
  // yang berhasil diupdate tidak sama dengan yang diharapkan, berarti ada
  // slot yang baru saja direbut booking lain (race condition) -> rollback.
  const { data: lockedSlots, error: lockError } = await supabase
    .from("slots")
    .update({ is_available: false })
    .in("id", neededSlotIds)
    .eq("is_available", true)
    .select("*");

  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

  if (!lockedSlots || lockedSlots.length !== neededSlotIds.length) {
    // rollback sebagian: buka kembali slot yang sempat terkunci
    if (lockedSlots && lockedSlots.length > 0) {
      await supabase
        .from("slots")
        .update({ is_available: true })
        .in("id", lockedSlots.map((s) => s.id));
    }
    return NextResponse.json(
      { error: "Slot ini baru saja dibooking orang lain. Silakan pilih slot lain." },
      { status: 409 }
    );
  }

  // Step 4: insert booking. service_id (kolom lama) langsung diisi layanan
  // pertama supaya kode lama yang masih baca booking.service_id tetap jalan;
  // kalau dijalankan di DB yang sudah pakai migration_multi_service.sql,
  // trigger di DB juga akan menjaga kolom ini tetap sinkron otomatis.
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      user_id: userSession?.id ?? null,
      barber_id: barber_id ?? baseSlot.barber_id,
      service_id: orderedServices[0]?.id ?? null,
      slot_id, // slot utama/pertama tetap dicatat sebagai acuan jam mulai
      notes: notes ?? null,
      walkin_name: isAdminBooking ? walkin_name : null,
      walkin_phone: isAdminBooking ? walkin_phone : null,
      created_by_admin: !!isAdminBooking,
      status: isAdminBooking ? "PENDING" : "WAITING_PAYMENT",
    })
    .select("*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*)")
    .single();

  if (bookingError) {
    // rollback: buka kembali semua slot yang terkunci
    await supabase.from("slots").update({ is_available: true }).in("id", neededSlotIds);
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Step 5: insert baris booking_services untuk SETIAP layanan yang dipilih.
  const bookingServiceRows = orderedServices.map((s, idx) => ({
    booking_id: booking.id,
    service_id: s.id,
    service_name: s.name,
    service_price: s.price,
    service_price_min: s.price_min,
    service_price_max: s.price_max,
    duration_minutes: s.duration_minutes,
    sort_order: idx,
  }));

  const { data: insertedServices, error: bsError } = await supabase
    .from("booking_services")
    .insert(bookingServiceRows)
    .select("*, service:services(*)");

  if (bsError) {
    // rollback: hapus booking & buka kembali semua slot
    await supabase.from("bookings").delete().eq("id", booking.id);
    await supabase.from("slots").update({ is_available: true }).in("id", neededSlotIds);
    return NextResponse.json({ error: bsError.message }, { status: 500 });
  }

  // Step 6: buat baris payment kalau ini booking pelanggan (bukan walk-in admin).
  // amount & service_price dihitung dari TOTAL semua layanan yang dipilih.
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
      // rollback: hapus booking (booking_services ikut terhapus otomatis
      // lewat on delete cascade) & buka kembali semua slot
      await supabase.from("bookings").delete().eq("id", booking.id);
      await supabase.from("slots").update({ is_available: true }).in("id", neededSlotIds);
      return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }
    payment = paymentRow;
  }

  // Notifikasi ke admin (in-app log; pengiriman WA aktual ditangani modul Fonnte/Wablas terpisah)
  const serviceNamesForNotif = orderedServices.map((s) => s.name).join(", ");
  await supabase.from("notifications").insert({
    type: "booking_baru",
    message: `Ada booking baru dari ${booking.walkin_name ?? userSession?.name ?? "pelanggan"} untuk ${serviceNamesForNotif || "layanan"}.`,
  });

  return NextResponse.json({
    booking: { ...booking, services: insertedServices ?? bookingServiceRows, payment },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToTarget } from "@/lib/push";

// GET — ambil semua booking/payment yang "nyangkut"
export async function GET() {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Booking CONFIRMED ("lupa dimulai") ATAU IN_PROGRESS ("lupa diselesaikan")
  // yang slotnya sudah lewat lebih dari 3 jam. Sebelumnya di sini cuma
  // status IN_PROGRESS yang diambil, jadi booking CONFIRMED yang barber-nya
  // lupa klik "Mulai" sama sekali tidak pernah muncul di halaman resolve —
  // padahal itu justru yang paling sering nyangkut (lihat alert dashboard).
  // Threshold disamakan dengan definisi "terlambat" di /api/admin-stats (3 jam)
  // supaya konsisten dengan yang ditampilkan di alert dashboard.
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: stuckBookings } = await supabase
    .from("bookings")
    .select(`
      id, status, walkin_name, walkin_phone, created_at,
      user:users(id, name, phone),
      barber:staff(id, name),
      slot:slots(id, date, start_time, end_time),
      services:booking_services(service_name, final_price, service_price)
    `)
    .in("status", ["CONFIRMED", "IN_PROGRESS"])
    .order("created_at", { ascending: true });

  // Filter di sisi aplikasi karena slot adalah join (tidak bisa filter langsung)
  const filteredStuck = (stuckBookings ?? []).filter((b) => {
    const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
    if (!slot?.date || !slot?.start_time) return true; // include jika slot tidak jelas
    const slotStart = new Date(`${slot.date}T${slot.start_time}`);
    return slotStart.toISOString() < threeHoursAgo;
  });

  // 2. Pembayaran PENDING_REVIEW yang sudah lebih dari 24 jam
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stuckPayments } = await supabase
    .from("bookings")
    .select(`
      id, status, walkin_name, created_at,
      user:users(id, name, phone),
      barber:staff(id, name),
      slot:slots(id, date, start_time),
      payment:payments(id, status, amount, uploaded_at),
      services:booking_services(service_name, final_price, service_price)
    `)
    .in("status", ["PENDING", "CONFIRMED"])
    .not("payment", "is", null)
    .order("created_at", { ascending: true });

  const filteredPayments = (stuckPayments ?? []).filter((b) => {
    const payment = Array.isArray(b.payment) ? b.payment[0] : b.payment;
    if (payment?.status !== "PENDING_REVIEW") return false;
    const uploadedAt = payment?.uploaded_at ?? b.created_at;
    return uploadedAt < oneDayAgo;
  });

  return NextResponse.json({
    stuckBookings: filteredStuck,
    stuckPayments: filteredPayments,
  });
}

// POST — resolve satu booking atau payment
export async function POST(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, bookingId, action } = body as {
    type: "booking" | "payment";
    bookingId: string;
    action: "done" | "cancel" | "expire" | "confirm";
  };

  const supabase = createAdminClient();

  if (type === "booking") {
    const newStatus = action === "done" ? "DONE" : "CANCELLED_ADMIN";

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, user_id, walkin_name, slot:slots(date, start_time), barber:staff(name)")
      .eq("id", bookingId)
      .maybeSingle();

    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (error) {
      return NextResponse.json({ error: "Gagal mengupdate booking." }, { status: 500 });
    }

    // Notifikasi ke pelanggan
    const slot = Array.isArray(booking?.slot) ? booking?.slot[0] : booking?.slot;
    const notifMsg = newStatus === "DONE"
      ? `Booking kamu pada ${slot?.date ?? ""} jam ${slot?.start_time?.slice(0, 5) ?? ""} telah diselesaikan oleh admin.`
      : `Booking kamu pada ${slot?.date ?? ""} jam ${slot?.start_time?.slice(0, 5) ?? ""} dibatalkan oleh admin.`;

    if (booking?.user_id) {
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        type: `booking_${newStatus.toLowerCase()}`,
        message: notifMsg,
      });
      try {
        await sendPushToTarget(
          { userId: booking.user_id },
          { title: "Glori Barbershop", body: notifMsg, url: "/booking/status", tag: `booking-${bookingId}` }
        );
      } catch { /* VAPID opsional */ }
    }

    return NextResponse.json({ ok: true });
  }

  if (type === "payment") {
    // expire = tutup pembayaran, booking kembali ke PENDING.
    // Nilai status harus salah satu dari enum payment_status di database
    // (WAITING_PROOF | PENDING_REVIEW | CONFIRMED | REJECTED) — "EXPIRED"
    // bukan nilai yang valid, jadi update ini akan gagal kalau tidak diganti
    // ke REJECTED (konsisten dengan cara file lain menutup payment basi,
    // lihat src/app/api/bookings/route.ts & payments/upload-proof/route.ts).
    const { error: payErr } = await supabase
      .from("payments")
      .update({
        status: "REJECTED",
        rejection_reason: "Pembayaran kedaluwarsa (lebih dari 24 jam menunggu verifikasi).",
      })
      .eq("booking_id", bookingId)
      .eq("status", "PENDING_REVIEW");

    if (payErr) {
      return NextResponse.json({ error: "Gagal mengupdate pembayaran." }, { status: 500 });
    }

    // Reset booking ke PENDING supaya pelanggan bisa upload ulang
    await supabase
      .from("bookings")
      .update({ status: "PENDING", updated_at: new Date().toISOString() })
      .eq("id", bookingId);

    // Notif ke pelanggan
    const { data: booking } = await supabase
      .from("bookings")
      .select("user_id")
      .eq("id", bookingId)
      .maybeSingle();

    if (booking?.user_id) {
      const msg = "Bukti pembayaran kamu telah kadaluarsa. Silakan upload ulang bukti transfer.";
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        type: "payment_expired",
        message: msg,
      });
      try {
        await sendPushToTarget(
          { userId: booking.user_id },
          { title: "Glori Barbershop", body: msg, url: "/booking/status", tag: `payment-${bookingId}` }
        );
      } catch { /* VAPID opsional */ }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// PATCH /api/payments/[id]
// Body: { action: "CONFIRM" } atau { action: "REJECT", rejection_reason?: string }
// Hanya admin yang boleh memverifikasi pembayaran.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "CONFIRM" | "REJECT" | undefined;

  const staffSession = await getStaffSession();
  if (!staffSession || staffSession.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (action !== "CONFIRM" && action !== "REJECT") {
    return NextResponse.json({ error: "Aksi tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*, booking:bookings(*, service:services(*), services:booking_services(*, service:services(*)), user:users(id, name, phone))")
    .eq("id", id)
    .single();

  if (paymentError || !payment) {
    return NextResponse.json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
  }

  if (payment.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "Pembayaran ini sudah diproses sebelumnya." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();

  if (action === "CONFIRM") {
    const { error: updatePaymentError } = await supabase
      .from("payments")
      .update({ status: "CONFIRMED", reviewed_by: staffSession.id, reviewed_at: nowIso })
      .eq("id", id);
    if (updatePaymentError) {
      return NextResponse.json({ error: updatePaymentError.message }, { status: 500 });
    }

    const { data: updatedBooking, error: updateBookingError } = await supabase
      .from("bookings")
      .update({ status: "CONFIRMED" })
      .eq("id", payment.booking_id)
      .select("*, service:services(*), services:booking_services(*, service:services(*)), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone)")
      .single();
    if (updateBookingError) {
      return NextResponse.json({ error: updateBookingError.message }, { status: 500 });
    }

    if (updatedBooking.user_id) {
      const serviceLabel = formatBookingServiceNames(updatedBooking.services, updatedBooking.service);
      await supabase.from("notifications").insert({
        user_id: updatedBooking.user_id,
        type: "pembayaran_confirmed",
        message: `Pembayaran kamu sudah diverifikasi! Booking ${serviceLabel} dikonfirmasi. Datang jam ${
          updatedBooking.slot ? updatedBooking.slot.start_time.slice(0, 5) : ""
        }.`,
      });
    }

    return NextResponse.json({ booking: updatedBooking });
  }

  // action === "REJECT"
  const rejectionReason = (body.rejection_reason as string) || "Bukti transfer tidak valid.";

  const { error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      status: "REJECTED",
      rejection_reason: rejectionReason,
      reviewed_by: staffSession.id,
      reviewed_at: nowIso,
    })
    .eq("id", id);
  if (updatePaymentError) {
    return NextResponse.json({ error: updatePaymentError.message }, { status: 500 });
  }

  // Trigger DB (trg_cancel_booking_on_payment_rejected) otomatis mengubah
  // booking jadi CANCELLED_ADMIN, yang lalu otomatis melepas slot
  // (trg_release_slot). Kita ambil ulang datanya untuk respons & notifikasi.
  const { data: updatedBooking } = await supabase
    .from("bookings")
    .select("*, service:services(*), services:booking_services(*, service:services(*)), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone)")
    .eq("id", payment.booking_id)
    .single();

  if (updatedBooking?.user_id) {
    const serviceLabel = formatBookingServiceNames(updatedBooking.services, updatedBooking.service);
    await supabase.from("notifications").insert({
      user_id: updatedBooking.user_id,
      type: "pembayaran_rejected",
      message: `Bukti transfer untuk booking ${serviceLabel} ditolak: ${rejectionReason}. Booking dibatalkan, silakan booking ulang.`,
    });
  }

  return NextResponse.json({ booking: updatedBooking });
}

// Gabungkan nama-nama layanan dari booking_services jadi satu baris teks
// untuk pesan notifikasi. Fallback ke relasi service tunggal (kolom lama)
// kalau booking_services kosong (mis. booking lama sebelum migration ini).
function formatBookingServiceNames(
  services: { service_name?: string }[] | undefined,
  fallbackService: { name?: string } | undefined
): string {
  if (services && services.length > 0) {
    return services.map((s) => s.service_name).filter(Boolean).join(", ");
  }
  return fallbackService?.name ?? "layanan";
}

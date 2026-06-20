import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession } from "@/lib/session";
import { isPaymentExpired } from "@/lib/payment";

export const dynamic = "force-dynamic";

const BUCKET = "payment-proofs";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// POST /api/payments/upload-proof
// FormData: file, booking_id
// Pelanggan upload bukti transfer untuk booking miliknya sendiri.
// Setelah upload sukses: payment.status -> PENDING_REVIEW, booking.status -> PENDING.
export async function POST(req: NextRequest) {
  const userSession = await getUserSession();
  if (!userSession) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const bookingId = formData?.get("booking_id");

  if (!bookingId || typeof bookingId !== "string") {
    return NextResponse.json({ error: "booking_id wajib diisi." }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File bukti transfer tidak ditemukan." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Format file harus JPG, PNG, WEBP, AVIF, atau PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Ukuran file maksimal 5MB." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Pastikan booking ini milik user yang login & masih dalam status yang valid untuk upload bukti.
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, user_id, status")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking tidak ditemukan." }, { status: 404 });
  }
  if (booking.user_id !== userSession.id) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  if (booking.status !== "WAITING_PAYMENT") {
    return NextResponse.json(
      { error: "Booking ini tidak lagi menunggu pembayaran." },
      { status: 400 }
    );
  }

  const { data: payment, error: paymentFindError } = await supabase
    .from("payments")
    .select("*")
    .eq("booking_id", bookingId)
    .single();

  if (paymentFindError || !payment) {
    return NextResponse.json({ error: "Data pembayaran tidak ditemukan." }, { status: 404 });
  }

  if (isPaymentExpired(payment.expires_at)) {
    // Sudah lewat waktu; batalkan di sini juga (tidak perlu menunggu lazy-check GET).
    await supabase.from("bookings").update({ status: "CANCELLED_ADMIN" }).eq("id", bookingId);
    await supabase
      .from("payments")
      .update({ status: "REJECTED", rejection_reason: "Waktu pembayaran habis (30 menit)." })
      .eq("id", payment.id);
    return NextResponse.json(
      { error: "Waktu pembayaran sudah habis. Silakan booking ulang." },
      { status: 400 }
    );
  }

  if (payment.status !== "WAITING_PROOF") {
    return NextResponse.json(
      { error: "Bukti pembayaran untuk booking ini sudah pernah dikirim." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${bookingId}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data: updatedPayment, error: updatePaymentError } = await supabase
    .from("payments")
    .update({
      proof_url: fileName, // simpan path, bukan public URL (bucket privat)
      proof_uploaded_at: nowIso,
      status: "PENDING_REVIEW",
    })
    .eq("id", payment.id)
    .select("*")
    .single();

  if (updatePaymentError) {
    return NextResponse.json({ error: updatePaymentError.message }, { status: 500 });
  }

  const { data: updatedBooking, error: updateBookingError } = await supabase
    .from("bookings")
    .update({ status: "PENDING" })
    .eq("id", bookingId)
    .select("*, service:services(*), services:booking_services(*, service:services(*)), barber:staff(id, name, photo_url), slot:slots(*)")
    .single();

  if (updateBookingError) {
    return NextResponse.json({ error: updateBookingError.message }, { status: 500 });
  }

  const serviceLabel =
    Array.isArray(updatedBooking.services) && updatedBooking.services.length > 0
      ? updatedBooking.services.map((s: { service_name: string }) => s.service_name).join(", ")
      : updatedBooking.service?.name ?? "layanan";

  await supabase.from("notifications").insert({
    type: "bukti_pembayaran_baru",
    message: `Bukti transfer baru diunggah untuk booking ${serviceLabel}. Mohon segera diverifikasi.`,
  });

  return NextResponse.json({ booking: updatedBooking, payment: updatedPayment });
}

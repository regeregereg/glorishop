import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";
import { BookingStatus } from "@/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const newStatus = body.status as BookingStatus;

  const userSession = await getUserSession();
  const staffSession = await getStaffSession();

  if (!userSession && !staffSession) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: existing, error: findError } = await supabase
    .from("bookings")
    .select("*, slot:slots(*)")
    .eq("id", id)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Booking tidak ditemukan." }, { status: 404 });
  }

  // Validasi otorisasi & aturan bisnis per jenis perubahan status
  if (newStatus === "CANCELLED_USER") {
    if (!userSession || existing.user_id !== userSession.id) {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }
    // Booking yang belum dibayar/belum diverifikasi (WAITING_PAYMENT, PENDING)
    // boleh dibatalkan kapan saja oleh pelanggan tanpa aturan H-1, karena belum
    // ada komitmen barbershop yang dikonfirmasi. Aturan H-1 hanya berlaku
    // setelah status CONFIRMED.
    if (existing.status === "CONFIRMED" && existing.slot) {
      const slotDate = new Date(existing.slot.date + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((slotDate.getTime() - today.getTime()) / 86400000);
      if (diffDays < 1) {
        return NextResponse.json(
          { error: "Pembatalan hanya bisa dilakukan maksimal H-1 sebelum jadwal." },
          { status: 400 }
        );
      }
    }
  } else if (newStatus === "CANCELLED_ADMIN" || newStatus === "CONFIRMED" || newStatus === "NO_SHOW") {
    if (!staffSession || staffSession.role !== "admin") {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }
    // Booking pelanggan (bukan walk-in) yang masih WAITING_PAYMENT belum
    // pernah mengirim bukti transfer sama sekali, jadi tidak boleh
    // dikonfirmasi langsung di sini — admin harus menunggu pelanggan upload
    // bukti, lalu verifikasi lewat endpoint /api/payments/[id] (CONFIRM/REJECT).
    if (newStatus === "CONFIRMED" && existing.status === "WAITING_PAYMENT" && !existing.created_by_admin) {
      return NextResponse.json(
        { error: "Booking ini belum ada bukti transfer. Verifikasi lewat menu Pembayaran setelah pelanggan mengunggah bukti." },
        { status: 400 }
      );
    }
  } else if (newStatus === "IN_PROGRESS" || newStatus === "DONE") {
    if (!staffSession || (staffSession.role !== "barber" && staffSession.role !== "admin")) {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (body.final_price !== undefined) updatePayload.final_price = body.final_price;

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", id)
    .select("*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone)")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Catat notifikasi terkait perubahan status
  const notifMap: Partial<Record<BookingStatus, string>> = {
    CONFIRMED: `Booking kamu dikonfirmasi! Datang jam ${updated.slot ? updated.slot.start_time.slice(0, 5) : ""}.`,
    CANCELLED_ADMIN: "Maaf, booking kamu tidak bisa dipenuhi. Silakan pilih waktu lain.",
    CANCELLED_USER: "Booking berhasil dibatalkan. Slot sudah dibuka kembali.",
    DONE: "Terima kasih sudah datang! Yuk beri rating untuk pengalamanmu.",
  };
  if (notifMap[newStatus] && updated.user_id) {
    await supabase.from("notifications").insert({
      user_id: updated.user_id,
      type: `booking_${newStatus.toLowerCase()}`,
      message: notifMap[newStatus],
    });
  }

  return NextResponse.json({ booking: updated });
}

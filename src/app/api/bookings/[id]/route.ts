import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";
import { BookingStatus } from "@/types";
import { sendPushToTarget } from "@/lib/push";
import { recalcRowCommission } from "@/lib/commission";

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
  // final_price (total gabungan, kolom lama) — tetap didukung untuk kompatibilitas.
  if (body.final_price !== undefined) updatePayload.final_price = body.final_price;

  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", id)
    .select(
      "*, service:services(*), services:booking_services(*, service:services(*)), barber:staff(id, name, photo_url), slot:slots(*), user:users(id, name, phone)"
    )
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // final_prices: { [booking_service_id]: number } — barber/admin konfirmasi
  // harga final PER LAYANAN satu-satu (terutama untuk layanan dengan range
  // harga seperti Colour/Bleaching). Dikirim terpisah dari final_price total
  // supaya tidak menabrak alur lama yang masih kirim final_price tunggal.
  // Setiap kali final_price per layanan diisi/diubah, commission_amount
  // dihitung ulang dari harga final tersebut (memakai commission_percentage
  // yang sudah di-snapshot di baris itu — TIDAK ambil ulang dari tabel
  // services, sesuai aturan snapshot di src/lib/commission.ts).
  if (body.final_prices && typeof body.final_prices === "object") {
    const entries = Object.entries(body.final_prices as Record<string, number>);
    for (const [bookingServiceId, price] of entries) {
      const { data: rowBefore } = await supabase
        .from("booking_services")
        .select("commission_percentage")
        .eq("id", bookingServiceId)
        .eq("booking_id", id)
        .maybeSingle();

      const commissionAmount = recalcRowCommission({
        final_price: price,
        commission_percentage: rowBefore?.commission_percentage ?? null,
      });

      await supabase
        .from("booking_services")
        .update({ final_price: price, commission_amount: commissionAmount })
        .eq("id", bookingServiceId)
        .eq("booking_id", id);
    }
    // Ambil ulang booking_services terbaru setelah update harga final per layanan.
    const { data: refreshedServices } = await supabase
      .from("booking_services")
      .select("*, service:services(*)")
      .eq("booking_id", id)
      .order("sort_order", { ascending: true });
    if (refreshedServices) {
      updated.services = refreshedServices;
    }
  } else if (Array.isArray(updated.services)) {
    updated.services = [...updated.services].sort((a, c) => a.sort_order - c.sort_order);
  }

  // Saat booking ditandai DONE, pastikan commission_amount semua baris
  // layanan sudah terhitung dari harga final terakhir (untuk layanan harga
  // tetap yang tidak pernah lewat final_prices di atas, harga acuan
  // service_price/service_price_min dipakai sebagai dasar — lihat
  // getRowPriceForCommission di src/lib/commission.ts).
  if (newStatus === "DONE" && Array.isArray(updated.services) && updated.services.length > 0) {
    for (const row of updated.services as {
      id: string;
      final_price: number | null;
      service_price: number | null;
      service_price_min: number | null;
      commission_percentage: number | null;
      commission_amount: number | null;
    }[]) {
      const commissionAmount = recalcRowCommission(row);
      if (commissionAmount !== row.commission_amount) {
        await supabase
          .from("booking_services")
          .update({ commission_amount: commissionAmount })
          .eq("id", row.id);
        row.commission_amount = commissionAmount;
      }
    }
  }

  // Catat notifikasi terkait perubahan status
  const serviceNamesForNotif = Array.isArray(updated.services) && updated.services.length > 0
    ? updated.services.map((s: { service_name: string }) => s.service_name).join(", ")
    : updated.service?.name ?? "";
  // Notifikasi ke PELANGGAN saat status berubah
  const notifMap: Partial<Record<BookingStatus, string>> = {
    CONFIRMED: `Booking kamu dikonfirmasi! Datang jam ${updated.slot ? updated.slot.start_time.slice(0, 5) : ""}.`,
    CANCELLED_ADMIN: "Maaf, booking kamu tidak bisa dipenuhi. Silakan pilih waktu lain.",
    CANCELLED_USER: "Booking berhasil dibatalkan. Slot sudah dibuka kembali.",
    IN_PROGRESS: "Giliran kamu sudah dimulai. Selamat menikmati!",
    DONE: "Terima kasih sudah datang! Yuk beri rating untuk pengalamanmu.",
    NO_SHOW: "Booking kamu ditandai tidak hadir. Hubungi kami jika ada kendala.",
  };
  if (notifMap[newStatus] && updated.user_id) {
    await supabase.from("notifications").insert({
      user_id: updated.user_id,
      type: `booking_${newStatus.toLowerCase()}`,
      message: notifMap[newStatus],
    });

    try {
      await sendPushToTarget(
        { userId: updated.user_id },
        {
          title: "Glori Barbershop",
          body: notifMap[newStatus]!,
          url: "/booking/status",
          tag: `booking-${updated.id}`,
        }
      );
    } catch {
      // VAPID belum dikonfigurasi atau gagal kirim — diamkan
    }
  }

  // Notifikasi ke ADMIN saat barber menandai DONE — supaya admin tahu
  // dan bisa update laporan/komisi tanpa harus cek manual.
  if (newStatus === "DONE") {
    const barberName = updated.barber?.name ?? "Barber";
    const customerName = updated.user?.name ?? updated.walkin_name ?? "pelanggan";
    const doneMsg = `${barberName} selesai mengerjakan ${customerName} (${serviceNamesForNotif}).`;
    await supabase.from("notifications").insert({
      type: "booking_done",
      message: doneMsg,
    });
    try {
      const { sendPushToAllAdmins } = await import("@/lib/push");
      await sendPushToAllAdmins({
        title: "Pekerjaan Selesai — Glori Barbershop",
        body: doneMsg,
        url: "/admin/bookings",
        tag: `done-${updated.id}`,
      });
    } catch {
      // VAPID belum dikonfigurasi atau gagal kirim — diamkan
    }
  }

  // Notifikasi ke ADMIN saat admin menandai NO_SHOW
  if (newStatus === "NO_SHOW") {
    const customerName = updated.user?.name ?? updated.walkin_name ?? "pelanggan";
    const noShowMsg = `Booking ${customerName} ditandai tidak hadir (NO_SHOW).`;
    await supabase.from("notifications").insert({
      type: "booking_no_show",
      message: noShowMsg,
    });
  }

  void serviceNamesForNotif;

  return NextResponse.json({ booking: updated });
}

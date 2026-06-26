import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { sendPushToAllAdmins } from "@/lib/push";
import { calculateCommissionAmount, getRowPriceForCommission } from "@/lib/commission";
import { getEffectivePrice } from "@/lib/pricing";
import { toLocalDateString } from "@/lib/utils";
import { Service } from "@/types";

// POST /api/bookings/walkin
// Dipakai BARBER (dari dashboard barber) untuk mencatat pelanggan yang
// datang LANGSUNG ke tempat tanpa booking sebelumnya (bayar di tempat).
// Berbeda dari "Booking Walk-in" admin (lihat /api/bookings dengan
// created_by_admin) yang masih perlu pilih slot kosong secara manual —
// endpoint ini TIDAK butuh pilih slot sama sekali: sistem otomatis
// membuat/mengunci satu slot "sekarang" untuk barber yang bersangkutan,
// lalu booking langsung berstatus CONFIRMED (dianggap sudah dibayar di
// tempat, tidak lewat alur QRIS/upload bukti seperti booking online).
//
// Tercatat otomatis ke sistem admin lewat tabel bookings yang sama —
// admin melihatnya di halaman "Semua Booking" / laporan seperti booking
// lainnya, dibedakan lewat kolom walkin_by_barber = true.
//
// Layanan HOME SERVICE (ke rumah) TIDAK BOLEH dipakai di sini — layanan
// itu wajib booking di muka lewat halaman booking pelanggan, bukan
// dicatat sebagai walk-in di tempat.
export async function POST(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || (staff.role !== "barber" && staff.role !== "admin")) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();

  // barber_id boleh dikirim eksplisit (dipakai kalau admin yang mencatat
  // atas nama barber tertentu); kalau tidak dikirim, default ke staff yang
  // sedang login. Barber HANYA boleh mencatat untuk dirinya sendiri — tidak
  // boleh mengisi barber_id milik barber lain (cegah barber A mencatut
  // komisi ke barber B).
  const requestedBarberId: string | undefined = body.barber_id;
  if (staff.role === "barber" && requestedBarberId && requestedBarberId !== staff.id) {
    return NextResponse.json({ error: "Tidak diizinkan mencatat untuk barber lain." }, { status: 403 });
  }
  const barberId = staff.role === "barber" ? staff.id : requestedBarberId || staff.id;

  const rawServiceIds: unknown = body.service_ids ?? (body.service_id ? [body.service_id] : []);
  const serviceIds: string[] = Array.isArray(rawServiceIds)
    ? Array.from(new Set(rawServiceIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];

  if (serviceIds.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu layanan." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: selectedServices, error: serviceError } = await supabase
    .from("services")
    .select("*, barber_prices:service_barber_prices(*)")
    .in("id", serviceIds);

  if (serviceError || !selectedServices || selectedServices.length !== serviceIds.length) {
    return NextResponse.json({ error: "Salah satu layanan yang dipilih tidak ditemukan." }, { status: 404 });
  }

  const orderedServices: Service[] = serviceIds
    .map((id) => selectedServices.find((s) => s.id === id))
    .filter((s): s is Service => !!s);

  // Layanan home service WAJIB booking di muka, tidak boleh dicatat
  // sebagai walk-in di tempat sama sekali.
  const homeServiceItems = orderedServices.filter(
    (s) => s.is_home_service_only || s.category === "home_service"
  );
  if (homeServiceItems.length > 0) {
    return NextResponse.json(
      {
        error: `Layanan berikut wajib booking di muka, tidak bisa dicatat sebagai walk-in: ${homeServiceItems
          .map((s) => s.name)
          .join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const totalDurationMin = orderedServices.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Buat (atau pakai ulang) satu slot "sekarang" untuk barber ini, dibulatkan
  // ke menit terdekat. unique(barber_id, date, start_time) di tabel slots
  // mencegah duplikat persis di detik yang sama; upsert+ignoreDuplicates
  // membuat ini aman dari race condition kalau barber tap dua kali cepat.
  const now = new Date();
  const todayStr = toLocalDateString(now);
  // Gunakan locale WIB (Asia/Jakarta) bukan toTimeString() yang mengikuti
  // timezone server (UTC di Vercel) — supaya jam yang tersimpan di slot
  // adalah jam LOKAL Indonesia, bukan jam UTC yang selisih 7 jam.
  const toWIBTime = (d: Date) =>
    d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(/\./g, ":"); // id-ID pakai titik sebagai separator, ubah ke ":"
  const startTime = toWIBTime(now);
  const endDate = new Date(now.getTime() + Math.max(totalDurationMin, 1) * 60 * 1000);
  const endTime = toWIBTime(endDate);

  const { error: slotUpsertError } = await supabase
    .from("slots")
    .upsert(
      [{ barber_id: barberId, date: todayStr, start_time: startTime, end_time: endTime, is_available: false }],
      { onConflict: "barber_id,date,start_time" }
    );

  if (slotUpsertError) {
    return NextResponse.json({ error: slotUpsertError.message }, { status: 500 });
  }

  const { data: slotRow, error: slotFetchError } = await supabase
    .from("slots")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", todayStr)
    .eq("start_time", startTime)
    .maybeSingle();

  if (slotFetchError || !slotRow) {
    return NextResponse.json({ error: "Gagal membuat slot waktu sekarang." }, { status: 500 });
  }

  // Insert booking langsung CONFIRMED — anggap pelanggan sudah di depan
  // barber, bayar di tempat, tidak ada alur menunggu verifikasi pembayaran.
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      user_id: null,
      barber_id: barberId,
      service_id: orderedServices[0]?.id ?? null,
      slot_id: slotRow.id,
      notes: body.notes ?? null,
      walkin_name: body.walkin_name || "Pelanggan Walk-in",
      walkin_phone: body.walkin_phone || null,
      created_by_admin: false,
      walkin_by_barber: true,
      status: "CONFIRMED",
    })
    .select("*, service:services(*), barber:staff(id, name, photo_url), slot:slots(*)")
    .single();

  if (bookingError) {
    // rollback: lepas slot kalau baru kita buat
    await supabase.from("slots").update({ is_available: true }).eq("id", slotRow.id);
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  // Snapshot komisi per layanan, sama seperti booking biasa. service_price/
  // price_min/price_max yang disnapshot adalah harga EFEKTIF untuk barber
  // yang mencatat walk-in ini (sudah memperhitungkan override per barber
  // kalau ada, lihat src/lib/pricing.ts). Untuk layanan dengan range harga
  // (mis. Colour), barber bisa langsung memasukkan harga final saat
  // mencatat walk-in lewat body.final_prices (keyed by service_id, BUKAN
  // booking_service id — karena baris booking_services belum ada saat
  // body ini dikirim). Kalau tidak diisi, final_price tetap kosong dan bisa
  // diisi belakangan lewat PATCH /api/bookings/[id].
  const finalPricesByServiceId: Record<string, number> =
    body.final_prices && typeof body.final_prices === "object" ? body.final_prices : {};

  const bookingServiceRows = orderedServices.map((s, idx) => {
    const effective = getEffectivePrice(s, barberId);
    const finalPrice = finalPricesByServiceId[s.id] != null ? Number(finalPricesByServiceId[s.id]) : null;
    const priceForCommission = getRowPriceForCommission({
      final_price: finalPrice,
      service_price: effective.price,
      service_price_min: effective.price_min,
    });
    return {
      booking_id: booking.id,
      service_id: s.id,
      service_name: s.name,
      service_price: effective.price,
      service_price_min: effective.price_min,
      service_price_max: effective.price_max,
      duration_minutes: s.duration_minutes,
      sort_order: idx,
      final_price: finalPrice,
      commission_percentage: s.commission_percentage ?? null,
      commission_amount: calculateCommissionAmount(priceForCommission, s.commission_percentage),
    };
  });

  const { data: insertedServices, error: bsError } = await supabase
    .from("booking_services")
    .insert(bookingServiceRows)
    .select("*, service:services(*)");

  if (bsError) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    await supabase.from("slots").update({ is_available: true }).eq("id", slotRow.id);
    return NextResponse.json({ error: bsError.message }, { status: 500 });
  }

  // Notifikasi ke admin — supaya transaksi walk-in ini langsung terlihat
  // di dashboard admin tanpa admin perlu input apa-apa.
  const serviceNamesForNotif = orderedServices.map((s) => s.name).join(", ");
  const adminNotifMessage = `${booking.barber?.name ?? "Barber"} mencatat cukur langsung (walk-in) untuk ${booking.walkin_name} — ${serviceNamesForNotif}.`;
  await supabase.from("notifications").insert({
    type: "walkin_barber",
    message: adminNotifMessage,
  });

  try {
    await sendPushToAllAdmins({
      title: "Walk-in Baru — Glori Barbershop",
      body: adminNotifMessage,
      url: "/admin/bookings",
      tag: `walkin-${booking.id}`,
    });
  } catch {
    // VAPID belum dikonfigurasi atau gagal kirim — diamkan, notifikasi
    // in-app di atas tetap tersimpan sebagai fallback.
  }

  return NextResponse.json({
    booking: { ...booking, services: insertedServices ?? bookingServiceRows },
  });
}

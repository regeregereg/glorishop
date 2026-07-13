import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { getBookingTotalPrice } from "@/lib/payment";
import { getBookingTotalCommission } from "@/lib/commission";

export async function GET() {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayBookingsRaw } = await supabase
    .from("bookings")
    .select(
      "*, service:services(*), services:booking_services(*), barber:staff(id, name), slot:slots(*), user:users(id, name, phone), payment:payments(*)"
    )
    .order("created_at", { ascending: false });

  // Supabase (tanpa generated DB types) kadang mengembalikan relasi to-one
  // (user, payment, barber, dst.) sebagai ARRAY, bukan objek tunggal —
  // sama seperti kasus "service" yang bikin build error sebelumnya. Kalau
  // tidak diratakan SEBELUM dipakai, kondisi seperti `b.payment.status ===
  // "CONFIRMED"` atau `b.payment?.status === "PENDING_REVIEW"` selalu
  // false (array tidak punya properti .status) — ini bug nyata, bukan cuma
  // soal tipe data. Diratakan SEKALI di sini supaya SEMUA pemakaian di
  // bawah (rincian Cash/TF-QR, widget Menunggu Verifikasi, dll) konsisten
  // aman, tidak perlu Array.isArray(...) berulang-ulang di tiap tempat.
  const todayBookings = (todayBookingsRaw ?? []).map((b) => ({
    ...b,
    payment: Array.isArray(b.payment) ? b.payment[0] ?? null : b.payment,
    user: Array.isArray(b.user) ? b.user[0] ?? null : b.user,
    barber: Array.isArray(b.barber) ? b.barber[0] ?? null : b.barber,
  }));

  const filteredToday = todayBookings.filter((b) => b.slot?.date === today);

  const omsetHariIni = filteredToday
    .filter((b) => b.status === "DONE")
    .reduce((sum, b) => sum + getBookingTotalPrice(b), 0);
  const komisiHariIni = filteredToday
    .filter((b) => ["CONFIRMED", "IN_PROGRESS", "DONE"].includes(b.status))
    .reduce((sum, b) => sum + getBookingTotalCommission(b), 0);

  // RINCIAN CASH vs TF/QR HARI INI — supaya owner tidak bingung pas hitung
  // uang cash di laci vs yang masuk rekening/QRIS. Aturan per booking DONE:
  // - Ada payment CONFIRMED (dibayar via QRIS saat booking online, DP atau
  //   Lunas) -> nominal payment.amount itu masuk kategori TF/QR.
  // - Sisa dari total booking (kalau DP) ATAU seluruh total (kalau tidak ada
  //   payment sama sekali / walk-in bayar cash di tempat) -> masuk cash.
  // Basis "total booking" dipakai bareng-bareng dengan omsetHariIni di atas
  // (getBookingTotalPrice) supaya cashHariIni + tfHariIni SELALU pas sama
  // dengan omsetHariIni, tidak ada selisih pembulatan.
  let cashHariIni = 0;
  let tfHariIni = 0;
  filteredToday
    .filter((b) => b.status === "DONE")
    .forEach((b) => {
      const total = getBookingTotalPrice(b);
      if (b.payment && b.payment.status === "CONFIRMED") {
        const paid = b.payment.amount ?? 0;
        tfHariIni += paid;
        cashHariIni += Math.max(total - paid, 0);
      } else {
        cashHariIni += total;
      }
    });

  const pendingCount = filteredToday.filter((b) => b.status === "PENDING").length;
  const activeCount = filteredToday.filter((b) =>
    ["CONFIRMED", "IN_PROGRESS"].includes(b.status)
  ).length;
  const doneCount = filteredToday.filter((b) => b.status === "DONE").length;
  // Walk-in yang dicatat BARBER sendiri hari ini (lihat POST /api/bookings/walkin)
  // — insight operasional, bukan cuma booking online.
  const walkinByBarberCount = filteredToday.filter((b) => b.walkin_by_barber).length;

  // BOOKING CONFIRMED/IN_PROGRESS YANG TERLAMBAT — barber lupa klik "Mulai"
  // (masih CONFIRMED) atau lupa klik "Selesai" (masih IN_PROGRESS) padahal
  // slot-nya sudah lama lewat. Definisi terlambat: lebih dari 3 jam dari jam
  // mulai slot (batas aman untuk layanan terpanjang sekalipun). Diambil dari
  // SEMUA booking (bukan cuma hari ini) supaya yang terlupakan dari hari
  // sebelumnya juga ikut terdeteksi.
  const { data: allConfirmedOrInProgress } = await supabase
    .from("bookings")
    .select("id, status, barber_id, walkin_name, created_at, slot:slots(date, start_time, end_time), barber:staff(id, name), user:users(id, name)")
    .in("status", ["CONFIRMED", "IN_PROGRESS"]);

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const bookingTerlambat = (allConfirmedOrInProgress ?? []).filter((b) => {
    // slot dari Supabase join adalah array — ambil elemen pertama
    const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
    if (!slot?.date || !slot?.start_time) return false;
    const slotStart = new Date(`${slot.date}T${slot.start_time}`);
    return slotStart < threeHoursAgo;
  }).map((b) => {
    const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
    return {
      bookingId: b.id,
      status: b.status as "CONFIRMED" | "IN_PROGRESS",
      barberId: b.barber_id,
      barberName: (Array.isArray(b.barber) ? b.barber[0] : b.barber as { name?: string } | null)?.name ?? "Barber",
      customerName: (Array.isArray(b.user) ? b.user[0] : b.user as { name?: string } | null)?.name ?? b.walkin_name ?? "Pelanggan",
      slotDate: slot?.date ?? null,
      slotTime: slot?.start_time ?? null,
    };
  });

  // PEMBAYARAN MENUNGGU VERIFIKASI — paling urgent untuk admin: pelanggan
  // sudah upload bukti transfer (PENDING_REVIEW) dan sedang menunggu di
  // halaman status booking-nya. Diambil dari SEMUA booking (bukan cuma
  // hari ini), karena slot booking-nya bisa untuk besok/lusa sementara
  // bukti transfer-nya diupload hari ini juga — yang penting kapan
  // verifikasinya, bukan kapan jadwal cukurnya.
  const pembayaranMenungguVerifikasi = todayBookings
    .filter((b) => b.payment?.status === "PENDING_REVIEW")
    .map((b) => ({
      bookingId: b.id,
      paymentId: b.payment!.id,
      customerName: b.user?.name ?? b.walkin_name ?? "Pelanggan",
      amount: b.payment!.amount,
      uploadedAt: b.payment!.proof_uploaded_at ?? b.payment!.created_at,
      slotDate: b.slot?.date ?? null,
      slotTime: b.slot?.start_time ?? null,
    }))
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));

  // NOTIFIKASI TERBARU UNTUK ADMIN — notifications dengan user_id & staff_id
  // keduanya NULL berarti notifikasi global ke semua admin (lihat konvensi
  // di POST /api/bookings, /api/bookings/walkin, /api/payments/upload-proof).
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, message, is_read, sent_at")
    .is("user_id", null)
    .is("staff_id", null)
    .order("sent_at", { ascending: false })
    .limit(15);
  const unreadNotificationCount = (notifications ?? []).filter((n) => !n.is_read).length;

  // KAPASITAS HARI INI PER BARBER — total slot vs yang masih kosong, supaya
  // admin tahu barber mana yang jadwalnya sudah penuh/masih longgar tanpa
  // harus buka Kelola Slot satu-satu.
  const { data: barbers } = await supabase
    .from("staff")
    .select("id, name")
    .eq("role", "barber")
    .eq("is_active", true);

  const { data: todaySlots } = await supabase
    .from("slots")
    .select("barber_id, is_available")
    .eq("date", today);

  const barberPerformance = (barbers ?? []).map((barber) => {
    const barberBookings = filteredToday.filter((b) => b.barber_id === barber.id);
    const barberSlots = (todaySlots ?? []).filter((s) => s.barber_id === barber.id);
    return {
      id: barber.id,
      name: barber.name,
      total: barberBookings.length,
      done: barberBookings.filter((b) => b.status === "DONE").length,
      slotTotal: barberSlots.length,
      slotKosong: barberSlots.filter((s) => s.is_available).length,
    };
  });

  return NextResponse.json({
    todayBookings: filteredToday,
    omsetHariIni,
    komisiHariIni,
    cashHariIni,
    tfHariIni,
    pendingCount,
    activeCount,
    doneCount,
    walkinByBarberCount,
    barberPerformance,
    pembayaranMenungguVerifikasi,
    bookingTerlambat,
    notifications: notifications ?? [],
    unreadNotificationCount,
  });
}

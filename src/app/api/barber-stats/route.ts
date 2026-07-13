import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { getBookingTotalPrice } from "@/lib/payment";

export async function GET(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedBarberId = searchParams.get("barberId");

  // barberId di query string berasal dari client dan TIDAK BISA dipercaya
  // begitu saja — barber hanya boleh melihat riwayat & rating MILIKNYA
  // SENDIRI (data ini termasuk nama pelanggan, jangan sampai bisa diintip
  // barber lain lewat mengganti angka di URL). Hanya admin yang boleh
  // minta data barber manapun.
  let barberId = staff.id;
  if (requestedBarberId) {
    if (staff.role !== "admin" && requestedBarberId !== staff.id) {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }
    barberId = requestedBarberId;
  }

  const supabase = createAdminClient();

  // Filter tanggal opsional (?from=YYYY-MM-DD&to=YYYY-MM-DD) untuk halaman
  // Riwayat Kerja barber — dipakai preset "7 Hari"/"30 Hari"/"Bulan Ini".
  // Kalau tidak dikirim (from & to kosong), berarti "Semua" — behaviour lama
  // tetap sama persis, tidak ada breaking change buat siapa pun yang belum
  // pakai filter ini.
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [{ data: bookingsRaw }, { data: reviews }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        // final_price & payment ditambahkan supaya barber bisa lihat rincian
        // Cash vs TF/QR per transaksi (buat cocokin manual sama uang fisik
        // di tangan) — logikanya sama persis dengan rincian Cash/TF-QR di
        // dashboard admin, supaya angkanya konsisten di kedua sisi.
        "id, status, updated_at, final_price, walkin_name, walkin_by_barber, service:services(name, price, price_min, price_max), services:booking_services(service_name, service_price, service_price_min, service_price_max, final_price, commission_percentage, commission_amount), user:users(id, name), slot:slots(date), payment:payments(id, status, payment_type, amount)"
      )
      .eq("barber_id", barberId)
      .eq("status", "DONE")
      .order("updated_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .eq("barber_id", barberId)
      .order("created_at", { ascending: false }),
  ]);

  // Filter di sisi aplikasi karena slot adalah join (tidak bisa filter
  // langsung lewat query builder Supabase untuk kolom di tabel relasi).
  const bookingsFiltered = (bookingsRaw ?? []).filter((b) => {
    if (!from && !to) return true;
    const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
    const date = slot?.date;
    if (!date) return true; // jangan sembunyikan data yang slotnya tidak jelas
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });

  // Supabase mengembalikan relasi payment (1:1) sebagai array — ratakan
  // jadi objek tunggal, sama seperti di /api/bookings.
  const bookings = bookingsFiltered.map((b) => ({
    ...b,
    payment: Array.isArray(b.payment) ? b.payment[0] ?? null : b.payment,
  }));

  // Rincian Cash vs TF/QR untuk periode yang lagi dipilih — aturan SAMA
  // PERSIS dengan /api/admin-stats supaya angka yang barber lihat di HP-nya
  // cocok dengan yang admin lihat di dashboard. Juga disematkan per-baris
  // (paymentMethod) supaya barber bisa cocokkan satu-satu transaksi mana
  // yang cash vs mana yang TF/QR terhadap uang fisik yang dipegangnya.
  let cashTotal = 0;
  let tfTotal = 0;
  const bookingsWithPaymentMethod = bookings.map((b) => {
    const total = getBookingTotalPrice(b);
    const isConfirmedPayment = b.payment && b.payment.status === "CONFIRMED";
    const paidViaTransfer = isConfirmedPayment ? b.payment!.amount ?? 0 : 0;
    const cashPortion = isConfirmedPayment ? Math.max(total - paidViaTransfer, 0) : total;
    cashTotal += cashPortion;
    tfTotal += paidViaTransfer;
    // Kalau ada payment terkonfirmasi yang menutup penuh total booking, ini
    // transaksi TF/QR murni; kalau ada tapi cuma sebagian (DP), sisanya
    // dianggap cash yang diterima di tempat; kalau tidak ada payment sama
    // sekali, ini cash penuh.
    const paymentMethod: "cash" | "qris" | "mixed" =
      !isConfirmedPayment ? "cash" : cashPortion === 0 ? "qris" : "mixed";
    return { ...b, paymentMethod, cashPortion, tfPortion: paidViaTransfer };
  });

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return NextResponse.json({
    bookings: bookingsWithPaymentMethod,
    reviews: reviews ?? [],
    avgRating,
    totalCompleted: bookings?.length ?? 0,
    cashTotal,
    tfTotal,
  });
}

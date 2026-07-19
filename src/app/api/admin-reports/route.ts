import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { getBookingTotalPrice } from "@/lib/payment";
import { getBookingTotalCommission } from "@/lib/commission";

export async function GET(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = searchParams.get("to") || new Date().toISOString().slice(0, 10);

  const supabase = createAdminClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, service:services(*), services:booking_services(*), barber:staff(id, name), slot:slots(*)")
    .eq("status", "DONE");

  const filtered = (bookings ?? []).filter(
    (b) => b.slot && b.slot.date >= from && b.slot.date <= to
  );

  const totalOmset = filtered.reduce((sum, b) => sum + getBookingTotalPrice(b), 0);
  // Total komisi yang harus dibayarkan ke SEMUA barber pada rentang ini —
  // berguna bagi owner untuk lihat berapa bagian yang jadi hak barber vs
  // yang jadi bagian barbershop (totalOmset - totalKomisi).
  const totalKomisi = filtered.reduce((sum, b) => sum + getBookingTotalCommission(b), 0);

  // Layanan populer dihitung PER LAYANAN INDIVIDUAL, bukan per booking —
  // supaya booking yang berisi beberapa layanan sekaligus (mis. Haircut +
  // Creambath) ikut menambah hitungan & omset untuk MASING-MASING layanan
  // tersebut, bukan cuma layanan pertamanya saja.
  const serviceCounts: Record<
    string,
    { name: string; count: number; revenue: number; commission: number }
  > = {};
  for (const b of filtered) {
    const rows =
      b.services && b.services.length > 0
        ? b.services.map(
            (s: {
              service_id: string;
              service_name: string;
              final_price: number | null;
              service_price: number | null;
              service_price_min: number | null;
              commission_amount: number | null;
            }) => ({
              id: s.service_id,
              name: s.service_name,
              revenue: s.final_price ?? s.service_price ?? s.service_price_min ?? 0,
              commission: s.commission_amount ?? 0,
            })
          )
        : b.service
          ? [
              {
                id: b.service.id,
                name: b.service.name,
                revenue: b.final_price ?? b.service.price ?? b.service.price_min ?? 0,
                commission: 0,
              },
            ]
          : [];

    for (const row of rows) {
      if (!serviceCounts[row.id]) {
        serviceCounts[row.id] = { name: row.name, count: 0, revenue: 0, commission: 0 };
      }
      serviceCounts[row.id].count += 1;
      serviceCounts[row.id].revenue += row.revenue;
      serviceCounts[row.id].commission += row.commission;
    }
  }
  const popularServices = Object.values(serviceCounts).sort((a, b) => b.count - a.count);

  const barberCounts: Record<
    string,
    { name: string; count: number; revenue: number; commission: number }
  > = {};
  for (const b of filtered) {
    if (!b.barber) continue;
    const key = b.barber.id;
    if (!barberCounts[key]) {
      barberCounts[key] = { name: b.barber.name, count: 0, revenue: 0, commission: 0 };
    }
    barberCounts[key].count += 1;
    barberCounts[key].revenue += getBookingTotalPrice(b);
    barberCounts[key].commission += getBookingTotalCommission(b);
  }
  const barberPerformance = Object.values(barberCounts).sort((a, b) => b.revenue - a.revenue);

  // omset per hari untuk grafik sederhana
  const dailyRevenue: Record<string, number> = {};
  for (const b of filtered) {
    if (!b.slot) continue;
    dailyRevenue[b.slot.date] = (dailyRevenue[b.slot.date] ?? 0) + getBookingTotalPrice(b);
  }

  // PENJUALAN PRODUK PADA RENTANG INI — terpisah dari bookings (lihat
  // supabase/migration_product_sales.sql). Digabung ke totalOmset & grafik
  // omset harian (produk juga bagian dari pemasukan toko), tapi ditampilkan
  // terpisah juga (totalOmsetProduk, produkTerlaris) supaya owner bisa
  // audit porsi layanan vs produk.
  const { data: productSales } = await supabase
    .from("product_sales")
    .select("*")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`);

  const totalOmsetProduk = (productSales ?? []).reduce((sum, s) => sum + s.total_price, 0);

  const productCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const s of productSales ?? []) {
    const key = s.product_id ?? s.product_name;
    if (!productCounts[key]) {
      productCounts[key] = { name: s.product_name, qty: 0, revenue: 0 };
    }
    productCounts[key].qty += s.quantity;
    productCounts[key].revenue += s.total_price;

    // ikut ditambahkan ke grafik omset harian supaya "Omset Harian" di
    // laporan mencerminkan pemasukan toko secara utuh, bukan cuma layanan.
    const dateKey = s.created_at.slice(0, 10);
    dailyRevenue[dateKey] = (dailyRevenue[dateKey] ?? 0) + s.total_price;
  }
  const produkTerlaris = Object.values(productCounts).sort((a, b) => b.qty - a.qty);

  const dailyRevenueArray = Object.entries(dailyRevenue)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalOmset: totalOmset + totalOmsetProduk,
    totalOmsetLayanan: totalOmset,
    totalOmsetProduk,
    totalKomisi,
    totalTransaksi: filtered.length,
    popularServices,
    produkTerlaris,
    barberPerformance,
    dailyRevenue: dailyRevenueArray,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { getBookingTotalPrice } from "@/lib/payment";

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

  // Layanan populer dihitung PER LAYANAN INDIVIDUAL, bukan per booking —
  // supaya booking yang berisi beberapa layanan sekaligus (mis. Haircut +
  // Creambath) ikut menambah hitungan & omset untuk MASING-MASING layanan
  // tersebut, bukan cuma layanan pertamanya saja.
  const serviceCounts: Record<string, { name: string; count: number; revenue: number }> = {};
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
            }) => ({
              id: s.service_id,
              name: s.service_name,
              revenue: s.final_price ?? s.service_price ?? s.service_price_min ?? 0,
            })
          )
        : b.service
          ? [
              {
                id: b.service.id,
                name: b.service.name,
                revenue: b.final_price ?? b.service.price ?? b.service.price_min ?? 0,
              },
            ]
          : [];

    for (const row of rows) {
      if (!serviceCounts[row.id]) {
        serviceCounts[row.id] = { name: row.name, count: 0, revenue: 0 };
      }
      serviceCounts[row.id].count += 1;
      serviceCounts[row.id].revenue += row.revenue;
    }
  }
  const popularServices = Object.values(serviceCounts).sort((a, b) => b.count - a.count);

  const barberCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const b of filtered) {
    if (!b.barber) continue;
    const key = b.barber.id;
    if (!barberCounts[key]) {
      barberCounts[key] = { name: b.barber.name, count: 0, revenue: 0 };
    }
    barberCounts[key].count += 1;
    barberCounts[key].revenue += getBookingTotalPrice(b);
  }
  const barberPerformance = Object.values(barberCounts).sort((a, b) => b.revenue - a.revenue);

  // omset per hari untuk grafik sederhana
  const dailyRevenue: Record<string, number> = {};
  for (const b of filtered) {
    if (!b.slot) continue;
    dailyRevenue[b.slot.date] = (dailyRevenue[b.slot.date] ?? 0) + getBookingTotalPrice(b);
  }
  const dailyRevenueArray = Object.entries(dailyRevenue)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalOmset,
    totalTransaksi: filtered.length,
    popularServices,
    barberPerformance,
    dailyRevenue: dailyRevenueArray,
  });
}

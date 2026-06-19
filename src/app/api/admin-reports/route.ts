import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

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
    .select("*, service:services(*), barber:staff(id, name), slot:slots(*)")
    .eq("status", "DONE");

  const filtered = (bookings ?? []).filter(
    (b) => b.slot && b.slot.date >= from && b.slot.date <= to
  );

  const totalOmset = filtered.reduce((sum, b) => {
    const price = b.final_price ?? b.service?.price ?? b.service?.price_min ?? 0;
    return sum + price;
  }, 0);

  const serviceCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const b of filtered) {
    if (!b.service) continue;
    const key = b.service.id;
    if (!serviceCounts[key]) {
      serviceCounts[key] = { name: b.service.name, count: 0, revenue: 0 };
    }
    serviceCounts[key].count += 1;
    serviceCounts[key].revenue += b.final_price ?? b.service.price ?? b.service.price_min ?? 0;
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
    barberCounts[key].revenue += b.final_price ?? b.service?.price ?? b.service?.price_min ?? 0;
  }
  const barberPerformance = Object.values(barberCounts).sort((a, b) => b.revenue - a.revenue);

  // omset per hari untuk grafik sederhana
  const dailyRevenue: Record<string, number> = {};
  for (const b of filtered) {
    if (!b.slot) continue;
    const price = b.final_price ?? b.service?.price ?? b.service?.price_min ?? 0;
    dailyRevenue[b.slot.date] = (dailyRevenue[b.slot.date] ?? 0) + price;
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

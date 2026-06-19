import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

export async function GET() {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayBookings } = await supabase
    .from("bookings")
    .select("*, service:services(*), barber:staff(id, name), slot:slots(*), user:users(id, name)")
    .order("created_at", { ascending: false });

  const filteredToday = (todayBookings ?? []).filter((b) => b.slot?.date === today);

  const omsetHariIni = filteredToday
    .filter((b) => b.status === "DONE")
    .reduce((sum, b) => {
      const price = b.final_price ?? b.service?.price ?? b.service?.price_min ?? 0;
      return sum + price;
    }, 0);

  const pendingCount = filteredToday.filter((b) => b.status === "PENDING").length;
  const activeCount = filteredToday.filter((b) =>
    ["CONFIRMED", "IN_PROGRESS"].includes(b.status)
  ).length;
  const doneCount = filteredToday.filter((b) => b.status === "DONE").length;

  const { data: barbers } = await supabase
    .from("staff")
    .select("id, name")
    .eq("role", "barber")
    .eq("is_active", true);

  const barberPerformance = (barbers ?? []).map((barber) => {
    const barberBookings = filteredToday.filter((b) => b.barber_id === barber.id);
    return {
      id: barber.id,
      name: barber.name,
      total: barberBookings.length,
      done: barberBookings.filter((b) => b.status === "DONE").length,
    };
  });

  return NextResponse.json({
    todayBookings: filteredToday,
    omsetHariIni,
    pendingCount,
    activeCount,
    doneCount,
    barberPerformance,
  });
}

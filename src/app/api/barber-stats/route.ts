import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId") || staff.id;

  const supabase = createAdminClient();

  const [{ data: bookings }, { data: reviews }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, service:services(*), user:users(id, name)")
      .eq("barber_id", barberId)
      .eq("status", "DONE")
      .order("updated_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("*")
      .eq("barber_id", barberId)
      .order("created_at", { ascending: false }),
  ]);

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return NextResponse.json({
    bookings: bookings ?? [],
    reviews: reviews ?? [],
    avgRating,
    totalCompleted: bookings?.length ?? 0,
  });
}

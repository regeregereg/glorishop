import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

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

  const [{ data: bookings }, { data: reviews }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        // Hanya kolom yang benar-benar dipakai di halaman riwayat barber
        // (langsung atau lewat getBookingServiceNames/getBookingPriceLabel/
        // getBookingTotalCommission di src/lib/utils.ts & src/lib/commission.ts)
        // — sebelumnya "*" mengambil semua kolom termasuk yang tidak
        // ditampilkan (notes, created_by_admin, dll), menambah ukuran
        // response tanpa manfaat.
        "id, status, updated_at, walkin_name, walkin_by_barber, service:services(name, price, price_min, price_max), services:booking_services(service_name, service_price, service_price_min, service_price_max, final_price, commission_percentage, commission_amount), user:users(id, name), slot:slots(date)"
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

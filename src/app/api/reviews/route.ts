import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userSession = await getUserSession();
  if (!userSession) {
    return NextResponse.json({ error: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const body = await req.json();
  const { booking_id, rating, comment } = body;

  if (!booking_id || !rating) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking tidak ditemukan." }, { status: 404 });
  }
  if (booking.user_id !== userSession.id) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  if (booking.status !== "DONE") {
    return NextResponse.json(
      { error: "Review hanya bisa diberikan setelah layanan selesai." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      booking_id,
      user_id: userSession.id,
      barber_id: booking.barber_id,
      rating,
      comment: comment ?? null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review: data });
}

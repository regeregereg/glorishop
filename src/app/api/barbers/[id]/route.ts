import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidatePath, revalidateTag } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("staff")
    .update({
      name: body.name,
      bio: body.bio,
      is_active: body.is_active,
      photo_url: body.photo_url,
      // Jam istirahat — dikirim sebagai "" oleh form saat admin
      // mengosongkan field, dinormalisasi ke null di sini supaya kolom
      // `time` di Postgres tidak error menerima string kosong. Kalau
      // key ini tidak dikirim sama sekali (mis. toggleActive yang cuma
      // update is_active), body.break_start bernilai undefined dan
      // otomatis tidak ikut di-update (nilai lama tetap tersimpan).
      ...(body.break_start !== undefined && { break_start: body.break_start || null }),
      ...(body.break_end !== undefined && { break_end: body.break_end || null }),
    })
    .eq("id", id)
    .select("id, username, name, role, is_active, bio, photo_url, break_start, break_end")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Profil barber (foto/nama/bio) bisa muncul di home + halaman profil
  // publiknya sendiri — paksa segar lagi sekarang.
  revalidateTag("barbers", "max");
  revalidateTag("home-data", "max");
  revalidatePath(`/barber/${id}`);

  return NextResponse.json({ barber: data });
}

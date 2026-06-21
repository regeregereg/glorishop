import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidatePath, revalidateTag } from "next/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const supabase = createAdminClient();
  let query = supabase.from("services").select("*").order("sort_order", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ services: data });
}

export async function POST(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      name: body.name,
      description: body.description ?? null,
      price: body.price ?? null,
      price_min: body.price_min ?? null,
      price_max: body.price_max ?? null,
      duration_minutes: body.duration_minutes ?? 30,
      category: body.category ?? "haircut",
      photo_url: body.photo_url ?? null,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Layanan baru harus langsung muncul di halaman publik (home, daftar
  // layanan, dipakai juga sebagai sumber data cache home) — paksa segar lagi
  // sekarang, jangan tunggu sampai cache 60 detik habis sendiri.
  revalidateTag("services", "max");
  revalidateTag("home-data", "max");
  revalidatePath("/layanan");

  return NextResponse.json({ service: data });
}

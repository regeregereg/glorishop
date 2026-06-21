import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidateTag } from "next/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const supabase = createAdminClient();
  let query = supabase.from("banners").select("*").order("sort_order", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ banners: data });
}

export async function POST(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  if (!body.image_url || !body.image_path) {
    return NextResponse.json({ error: "Gambar wajib diunggah." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("banners")
    .insert({
      image_url: body.image_url,
      image_path: body.image_path,
      sort_order: body.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Banner baru harus langsung muncul di carousel Home, jangan tunggu
  // cache home-data 60 detik habis sendiri.
  revalidateTag("banners", "max");
  revalidateTag("home-data", "max");

  return NextResponse.json({ banner: data });
}

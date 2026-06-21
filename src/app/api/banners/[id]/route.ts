import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidateTag } from "next/cache";

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
    .from("banners")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("banners", "max");
  revalidateTag("home-data", "max");

  return NextResponse.json({ banner: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const { id } = await params;
  const supabase = createAdminClient();

  // Beda dengan layanan (soft delete karena dipakai di histori booking),
  // banner tidak punya relasi histori apa pun — aman dihapus permanen
  // sekaligus file gambarnya di storage supaya tidak menumpuk sampah.
  const { data: banner } = await supabase
    .from("banners")
    .select("image_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (banner?.image_path) {
    await supabase.storage.from("photos").remove([banner.image_path]);
  }

  revalidateTag("banners", "max");
  revalidateTag("home-data", "max");

  return NextResponse.json({ ok: true });
}

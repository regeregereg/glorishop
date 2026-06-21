import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

// GET  /api/barbers/[id]/portfolio        -> publik, dipakai halaman profil barber
// POST /api/barbers/[id]/portfolio        -> admin only, tambah satu foto ke galeri

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("barber_portfolios")
    .select("id, barber_id, photo_url, sort_order, created_at")
    .eq("barber_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ portfolio: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const photoUrl = body.photo_url as string | undefined;

  if (!photoUrl) {
    return NextResponse.json({ error: "photo_url wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // foto baru ditaruh di urutan paling akhir
  const { data: last } = await supabase
    .from("barber_portfolios")
    .select("sort_order")
    .eq("barber_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("barber_portfolios")
    .insert({
      barber_id: id,
      photo_url: photoUrl,
      sort_order: nextSortOrder,
    })
    .select("id, barber_id, photo_url, sort_order, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Galeri portofolio tampil di halaman publik profil barber ini.
  revalidatePath(`/barber/${id}`);

  return NextResponse.json({ photo: data });
}

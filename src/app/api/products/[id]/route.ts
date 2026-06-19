import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

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
    .from("products")
    .update({
      name: body.name,
      price: body.price,
      stock: body.stock,
      photo_url: body.photo_url,
      is_active: body.is_active,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ product: data });
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
  // Soft delete: set is_active = false agar histori transaksi lama tetap valid
  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

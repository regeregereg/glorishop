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
  // Kolom dibatasi eksplisit (bukan update(body) langsung) — pola yang
  // sama dipakai endpoint products/barbers/banners, supaya body request
  // tidak bisa diam-diam menimpa kolom lain (mis. created_at) kalau
  // tabel ini nanti bertambah kolom baru yang tidak seharusnya diubah
  // lewat endpoint ini.
  const { data, error } = await supabase
    .from("services")
    .update({
      name: body.name,
      description: body.description,
      price: body.price,
      price_min: body.price_min,
      price_max: body.price_max,
      duration_minutes: body.duration_minutes,
      photo_url: body.photo_url,
      category: body.category,
      is_active: body.is_active,
      sort_order: body.sort_order,
      commission_percentage: body.commission_percentage,
      is_home_service_only: body.is_home_service_only,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sinkronisasi daftar barber yang menerima layanan ini, hanya kalau
  // body.barber_ids dikirim (array, boleh kosong untuk menghapus semua).
  // Pola sederhana: hapus semua relasi lama, insert ulang yang baru —
  // aman untuk skala kecil/menengah seperti Glori Barbershop dan
  // menghindari logika diff yang lebih kompleks.
  if (Array.isArray(body.barber_ids)) {
    await supabase.from("service_barbers").delete().eq("service_id", id);
    if (body.barber_ids.length > 0) {
      const rows = body.barber_ids.map((barberId: string) => ({ service_id: id, barber_id: barberId }));
      await supabase.from("service_barbers").insert(rows);
    }
  }

  // Paksa halaman home/daftar layanan/detail layanan ini segar lagi
  // sekarang, supaya perubahan admin (nama/harga/foto) langsung kelihatan
  // tanpa harus menunggu cache 60 detik habis sendiri.
  revalidateTag("services", "max");
  revalidateTag("home-data", "max");
  revalidatePath("/layanan");
  revalidatePath(`/layanan/${id}`);

  return NextResponse.json({ service: data });
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
  // Soft delete: set is_active = false agar histori booking lama tetap valid
  const { error } = await supabase.from("services").update({ is_active: false }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("services", "max");
  revalidateTag("home-data", "max");
  revalidatePath("/layanan");
  revalidatePath(`/layanan/${id}`);

  return NextResponse.json({ ok: true });
}

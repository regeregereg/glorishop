import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidatePath, revalidateTag } from "next/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const supabase = createAdminClient();
  let query = supabase
    .from("services")
    .select("*, service_barbers(barber_id), barber_prices:service_barber_prices(*)")
    .order("sort_order", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Ratakan relasi service_barbers jadi array id barber saja (barber_ids),
  // supaya gampang dipakai langsung di form admin & validasi booking.
  // barber_prices (override harga per barber) dibawa apa adanya — dipakai
  // di halaman booking (resolusi harga real-time) dan form admin layanan.
  const services = (data ?? []).map((s) => ({
    ...s,
    barber_ids: Array.isArray(s.service_barbers) ? s.service_barbers.map((r: { barber_id: string }) => r.barber_id) : [],
    service_barbers: undefined,
  }));

  return NextResponse.json({ services });
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
      commission_percentage: body.commission_percentage ?? null,
      is_home_service_only: !!body.is_home_service_only,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Kalau layanan ini home service & admin mengirim daftar barber yang
  // menerima, simpan relasinya. Untuk layanan biasa (bukan home service),
  // body.barber_ids diabaikan saja (tidak relevan, semua barber aktif
  // boleh menerima layanan biasa).
  if (body.is_home_service_only && Array.isArray(body.barber_ids) && body.barber_ids.length > 0) {
    const rows = body.barber_ids.map((barberId: string) => ({ service_id: data.id, barber_id: barberId }));
    await supabase.from("service_barbers").insert(rows);
  }

  // Simpan harga khusus per barber kalau admin mengisi (override).
  // body.barber_prices: array { barber_id, price?, price_min?, price_max? }
  // — baris dengan semua kolom harga kosong dilewati (tidak perlu disimpan).
  if (Array.isArray(body.barber_prices) && body.barber_prices.length > 0) {
    const rows = body.barber_prices
      .filter(
        (p: { barber_id?: string; price?: number | null; price_min?: number | null; price_max?: number | null }) =>
          p.barber_id && (p.price != null || (p.price_min != null && p.price_max != null))
      )
      .map((p: { barber_id: string; price?: number | null; price_min?: number | null; price_max?: number | null }) => ({
        service_id: data.id,
        barber_id: p.barber_id,
        price: p.price ?? null,
        price_min: p.price_min ?? null,
        price_max: p.price_max ?? null,
      }));
    if (rows.length > 0) {
      await supabase.from("service_barber_prices").insert(rows);
    }
  }

  // Layanan baru harus langsung muncul di halaman publik (home, daftar
  // layanan, dipakai juga sebagai sumber data cache home) — paksa segar lagi
  // sekarang, jangan tunggu sampai cache 60 detik habis sendiri.
  revalidateTag("services", "max");
  revalidateTag("home-data", "max");
  revalidatePath("/layanan");

  return NextResponse.json({ service: data });
}

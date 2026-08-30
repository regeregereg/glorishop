import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { revalidatePath, revalidateTag } from "next/cache";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const supabase = createAdminClient();
  let query = supabase
    .from("staff")
    .select("id, name, photo_url, bio, is_active, created_at, break_start, break_end")
    .eq("role", "barber")
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ barbers: data });
}

export async function POST(req: NextRequest) {
  const staffSession = await getStaffSession();
  if (!staffSession || staffSession.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const bcrypt = (await import("bcryptjs")).default;
  const body = await req.json();
  const supabase = createAdminClient();

  // Samakan normalisasi username dengan proses login (trim + huruf kecil),
  // supaya username custom seperti "Ferdi123" atau " ferdi123 " tetap bisa
  // dipakai login apa adanya, bukan cuma versi huruf kecil persis.
  const username = (body.username as string)?.trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "Username wajib diisi." }, { status: 400 });
  }

  const passwordHash = bcrypt.hashSync(body.password || "barber123", 10);

  const { data, error } = await supabase
    .from("staff")
    .insert({
      username,
      password_hash: passwordHash,
      role: "barber",
      name: body.name,
      bio: body.bio ?? null,
      photo_url: body.photo_url ?? null,
    })
    .select("id, username, name, role, is_active, created_at")
    .single();

  if (error) {
    // Kode 23505 = username-nya sudah dipakai barber/admin lain.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Username itu sudah dipakai. Pilih username lain." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("barbers", "max");
  revalidateTag("home-data", "max");

  return NextResponse.json({ barber: data });
}

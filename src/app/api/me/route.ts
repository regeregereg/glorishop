import { NextResponse } from "next/server";
import { getUserSession, getStaffSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Route ini WAJIB selalu dijalankan ulang per-request (tidak boleh di-cache).
// Tanpa ini, browser/proxy bisa menyimpan response lama dan membuat
// satu tab "melihat" sesi milik tab lain (mis. admin vs customer).
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const userSession = await getUserSession();
  const staff = await getStaffSession();

  // Kalau ada sesi user, ambil data lengkap dari DB (phone, wa_number, dsb)
  // supaya halaman Profil dan komponen lain bisa pakai tanpa fetch terpisah.
  let user = null;
  if (userSession) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("users")
      .select("id, name, phone, wa_number, avatar_url, created_at")
      .eq("id", userSession.id)
      .maybeSingle();
    user = data ?? userSession; // fallback ke session kalau DB error
  }

  return NextResponse.json(
    { user, staff },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

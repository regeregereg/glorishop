import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

const PUBLIC_KEYS = ["qris_image_url", "payment_account_name", "dp_percentage", "work_start_time"];

// GET /api/settings -> kembalikan setting yang memang publik (dipakai di halaman booking).
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", PUBLIC_KEYS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings: Record<string, string | null> = {};
  for (const row of data) settings[row.key] = row.value;

  return NextResponse.json({ settings });
}

// PATCH /api/settings -> admin update satu atau beberapa key sekaligus.
// Body: { qris_image_url?: string, payment_account_name?: string, dp_percentage?: string }
export async function PATCH(req: NextRequest) {
  const staffSession = await getStaffSession();
  if (!staffSession || staffSession.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const entries = Object.entries(body).filter(([key]) => PUBLIC_KEYS.includes(key));

  if (entries.length === 0) {
    return NextResponse.json({ error: "Tidak ada data valid untuk disimpan." }, { status: 400 });
  }

  const supabase = createAdminClient();

  for (const [key, value] of entries) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: value == null ? null : String(value) }, { onConflict: "key" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

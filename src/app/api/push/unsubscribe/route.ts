import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/push/unsubscribe
// Dipanggil saat pelanggan/staff menekan tombol "Matikan Notifikasi", atau
// otomatis oleh browser kalau subscription dicabut. Tidak perlu cek sesi
// login secara ketat di sini — cukup hapus berdasarkan endpoint, karena
// endpoint itu sendiri sudah unik & rahasia (hanya diketahui device terkait).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession, getStaffSession } from "@/lib/session";

// POST /api/push/subscribe
// Dipanggil dari browser setelah pelanggan/staff mengizinkan notifikasi.
// Menyimpan (atau memperbarui) push subscription milik sesi yang sedang
// login — bisa pelanggan (user) ATAU staff (admin/barber), tergantung
// sesi cookie mana yang aktif saat tombol "Aktifkan Notifikasi" ditekan.
export async function POST(req: NextRequest) {
  const [userSession, staffSession] = await Promise.all([
    getUserSession(),
    getStaffSession(),
  ]);

  if (!userSession && !staffSession) {
    return NextResponse.json({ error: "Harus login terlebih dahulu." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const subscription = body?.subscription;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Data subscription tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Prioritas: kalau ada sesi staff aktif, simpan sebagai staff (dashboard
  // admin/barber biasanya dibuka di device kerja terpisah). Kalau tidak,
  // simpan sebagai pelanggan.
  const row = staffSession
    ? { staff_id: staffSession.id, user_id: null }
    : { user_id: userSession!.id, staff_id: null };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      ...row,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers.get("user-agent") ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

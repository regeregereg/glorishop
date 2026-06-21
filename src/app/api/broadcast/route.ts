import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";
import { sendPushToTarget } from "@/lib/push";

export async function POST(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const message = (body.message as string)?.trim();
  if (!message) {
    return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: users, error: usersError } = await supabase.from("users").select("id");
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const rows = users.map((u) => ({
    user_id: u.id,
    type: "broadcast_promo",
    message,
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Web push (gratis, lewat VAPID — lihat src/lib/push.ts) ke setiap
  // pelanggan supaya broadcast benar-benar sampai sebagai notifikasi
  // sistem, bukan cuma tersimpan diam-diam di tabel notifications.
  // Dibungkus try/catch per pola yang sama dengan rute lain: kegagalan
  // push (mis. VAPID belum diset, belum ada subscription) tidak
  // menggagalkan broadcast itu sendiri karena baris notifications sudah
  // tersimpan sebagai fallback.
  let pushSent = 0;
  try {
    const results = await Promise.all(
      users.map((u) =>
        sendPushToTarget(
          { userId: u.id },
          {
            title: "Glori Barbershop",
            body: message,
            url: "/riwayat",
            tag: "broadcast-promo",
          }
        )
      )
    );
    pushSent = results.reduce((acc, r) => acc + r.sent, 0);
  } catch {
    // VAPID belum dikonfigurasi — diamkan, baris notifications tetap tersimpan.
  }

  return NextResponse.json({ sent: rows.length, pushSent });
}

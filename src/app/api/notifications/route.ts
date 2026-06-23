import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// PATCH /api/notifications
// Body: { markAllRead: true } -> tandai SEMUA notifikasi global admin
// (user_id & staff_id null) sebagai sudah dibaca. Dipakai dashboard admin
// supaya badge "belum dibaca" bisa di-clear setelah admin membuka/melihat
// daftar notifikasi.
export async function PATCH(req: NextRequest) {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await req.json();
  const supabase = createAdminClient();

  if (body.markAllRead) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .is("user_id", null)
      .is("staff_id", null)
      .eq("is_read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tidak ada aksi yang valid." }, { status: 400 });
}

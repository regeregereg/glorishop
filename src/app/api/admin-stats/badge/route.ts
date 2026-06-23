import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

// GET /api/admin-stats/badge
// Versi RINGAN dari /api/admin-stats, hanya 2 angka untuk badge notifikasi
// di sidebar/mobile bar admin (AdminSidebar, AdminMobileBar). Dipisah dari
// /api/admin-stats yang berat (ambil semua booking hari ini + join
// macam-macam) karena badge ini perlu di-poll lebih sering & dari hampir
// SETIAP halaman admin, bukan cuma dashboard.
export async function GET() {
  const staff = await getStaffSession();
  if (!staff || staff.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();

  const [{ count: pendingPaymentCount }, { count: unreadNotificationCount }] = await Promise.all([
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_REVIEW"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("user_id", null)
      .is("staff_id", null)
      .eq("is_read", false),
  ]);

  return NextResponse.json({
    pendingPaymentCount: pendingPaymentCount ?? 0,
    unreadNotificationCount: unreadNotificationCount ?? 0,
  });
}

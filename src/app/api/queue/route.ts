import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/queue
// Endpoint PUBLIK — tidak butuh sesi/login sama sekali.
// Mengembalikan antrian hari ini yang sedang aktif (CONFIRMED + IN_PROGRESS),
// hanya data yang aman ditampilkan ke umum: nama depan + inisial, barber,
// layanan, jam slot, status. Nomor HP dan data sensitif TIDAK ikut.
export async function GET() {
  const supabase = createAdminClient();

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  }); // YYYY-MM-DD di WIB

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      walkin_name,
      status,
      barber:staff!barber_id(id, name, photo_url),
      slot:slots!slot_id(date, start_time, end_time),
      services:booking_services(service_name, duration_minutes),
      service:services!service_id(name)
    `
    )
    .in("status", ["CONFIRMED", "IN_PROGRESS", "PENDING"])
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Gagal memuat antrian." }, { status: 500 });
  }

  // Filter hanya yang hari ini berdasarkan slot.date
  const todayQueue = (data ?? []).filter(
    (b: any) => b.slot?.date === today
  );

  // Transformasi — hanya ekspos data yang aman untuk publik
  const queue = todayQueue.map((b: any, i: number) => {
    // Nama: ambil nama depan + inisial belakang saja untuk privasi
    const rawName: string =
      b.walkin_name ?? "Pelanggan";
    const parts = rawName.trim().split(" ");
    const displayName =
      parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];

    // Layanan: ambil dari booking_services (multi-service) atau fallback ke service
    const serviceNames: string[] =
      b.services?.length > 0
        ? b.services.map((s: any) => s.service_name)
        : b.service?.name
        ? [b.service.name]
        : ["Layanan"];

    return {
      queueNumber: i + 1,
      id: b.id,
      displayName,
      status: b.status as string,
      barberName: (b.barber as any)?.name ?? "—",
      barberPhotoUrl: (b.barber as any)?.photo_url ?? null,
      serviceNames,
      slotStart: b.slot?.start_time ?? null,
      slotEnd: b.slot?.end_time ?? null,
    };
  });

  // Total antrian hari ini termasuk yang sudah DONE (buat context)
  const { count: totalToday } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("status", ["CONFIRMED", "IN_PROGRESS", "DONE", "PENDING"])
    .filter("slot.date", "eq", today);

  return NextResponse.json(
    {
      date: today,
      queue,
      activeCount: queue.length,
      totalToday: totalToday ?? queue.length,
    },
    {
      headers: {
        // Cache 30 detik di CDN (Vercel Edge), fresh tiap minta di browser
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}

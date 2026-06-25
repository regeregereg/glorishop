import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/admin-reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
// Rekap kehadiran semua staff aktif dalam satu rentang tanggal — dipakai
// di halaman Laporan untuk evaluasi (siapa sering telat/absen, total jam
// kerja per staff), dan di halaman cetak rekap absensi.
//
// "Terlambat" dihitung dengan membandingkan clock_in terhadap jam masuk
// standar yang diatur admin di Pengaturan (app_settings.work_start_time,
// default "09:00" kalau belum pernah diisi).
export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { searchParams } = new URL(request.url);

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const from = searchParams.get("from") ?? todayStr;
  const to = searchParams.get("to") ?? todayStr;

  if (from > to) {
    return NextResponse.json({ error: "Tanggal 'dari' tidak boleh setelah tanggal 'sampai'." }, { status: 400 });
  }

  // Ambil jam masuk standar dari pengaturan (fallback 09:00 kalau belum diisi)
  const { data: settingRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "work_start_time")
    .maybeSingle();
  const workStartTime = settingRow?.value || "09:00"; // format "HH:mm"

  // Semua staff aktif (admin + barber)
  const { data: staffList, error: staffError } = await supabase
    .from("staff")
    .select("id, name, role, photo_url")
    .eq("is_active", true)
    .order("name");

  if (staffError) {
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  // Semua record attendance dalam rentang tanggal
  const { data: attendanceList, error: attError } = await supabase
    .from("attendance")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date");

  if (attError) {
    return NextResponse.json({ error: attError.message }, { status: 500 });
  }

  // Hitung jumlah hari kalender dalam rentang (basis "Tidak Masuk" =
  // jumlah hari dalam rentang yang tidak punya record clock_in sama
  // sekali untuk staff itu, dan tanggalnya sudah lewat/hari ini —
  // bukan hari yang belum terjadi).
  const totalHariRentang = diffDaysInclusive(from, to);

  const perStaff = (staffList ?? []).map((staff) => {
    const records = (attendanceList ?? []).filter((a) => a.staff_id === staff.id);

    let hadir = 0;
    let terlambat = 0;
    let totalMenitKerja = 0;

    for (const r of records) {
      if (!r.clock_in) continue;
      hadir += 1;

      const jamMasuk = new Date(r.clock_in).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }); // "HH:mm"
      if (jamMasuk > workStartTime) terlambat += 1;

      if (r.clock_out) {
        const menit = Math.max(
          0,
          Math.round((new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000)
        );
        totalMenitKerja += menit;
      }
    }

    // Hari yang sudah lewat (atau hari ini) dalam rentang, tapi staff
    // sama sekali tidak punya record clock_in = dianggap tidak masuk.
    // Hari yang belum terjadi (di masa depan) tidak dihitung sebagai
    // "tidak masuk" supaya rekap tidak bias kalau admin pilih rentang
    // yang mencakup tanggal mendatang.
    const batasAkhirEfektif = to < todayStr ? to : todayStr;
    const hariBerlaku = batasAkhirEfektif < from ? 0 : diffDaysInclusive(from, batasAkhirEfektif);
    const tidakMasuk = Math.max(0, hariBerlaku - hadir);

    return {
      staff_id: staff.id,
      name: staff.name,
      role: staff.role,
      photo_url: staff.photo_url,
      hadir,
      terlambat,
      tidak_masuk: tidakMasuk,
      total_jam_kerja_menit: totalMenitKerja,
    };
  });

  return NextResponse.json({
    from,
    to,
    work_start_time: workStartTime,
    total_hari_rentang: totalHariRentang,
    staff: perStaff,
  });
}

function diffDaysInclusive(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  if (b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

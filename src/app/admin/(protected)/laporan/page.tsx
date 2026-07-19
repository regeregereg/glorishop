"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatRupiah, formatDateShort, toLocalDateString } from "@/lib/utils";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";
import { Wallet, ShoppingBag, HandCoins, Store, ClipboardCheck, Printer, Clock3, AlertTriangle, UserX, Package } from "lucide-react";

interface PopularService {
  name: string;
  count: number;
  revenue: number;
  commission: number;
}
interface ProdukTerlaris {
  name: string;
  qty: number;
  revenue: number;
}
interface BarberPerf {
  name: string;
  count: number;
  revenue: number;
  commission: number;
}
interface DailyRevenue {
  date: string;
  total: number;
}
interface AttendanceStaffRow {
  staff_id: string;
  name: string;
  role: "admin" | "barber";
  photo_url: string | null;
  hadir: number;
  terlambat: number;
  tidak_masuk: number;
  total_jam_kerja_menit: number;
}

function formatJamKerja(menit: number): string {
  if (menit <= 0) return "0j";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `${jam}j` : `${jam}j ${sisa}m`;
}

// Preset rentang tanggal cepat (7 Hari / 30 Hari / Bulan Ini / Bulan Lalu) —
// supaya owner tidak harus klik-klik input tanggal manual tiap kali mau
// lihat rekap standar. Input "Dari"/"Sampai" manual tetap ada dan tidak
// diubah sama sekali, ini cuma cara cepat buat ngisinya.
type DatePreset = "7d" | "30d" | "thisMonth" | "lastMonth";

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toLocalDateString(from), to: toLocalDateString(now) };
  }
  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: toLocalDateString(from), to: toLocalDateString(now) };
  }
  if (preset === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toLocalDateString(from), to: toLocalDateString(now) };
  }
  // lastMonth
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

export default function AdminLaporanPage() {
  // Default: awal bulan berjalan s/d hari ini — supaya admin buka Laporan
  // langsung lihat rekap "bulan ini" tanpa perlu pilih tanggal manual dulu.
  // Filter tanggal custom (Dari/Sampai) di bawah tetap bisa diubah bebas,
  // ini cuma mengubah nilai awal saat halaman pertama kali dibuka.
  const [from, setFrom] = useState(() => {
    const d = new Date();
    return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [to, setTo] = useState(() => toLocalDateString(new Date()));
  const [data, setData] = useState<{
    totalOmset: number;
    totalOmsetLayanan: number;
    totalOmsetProduk: number;
    totalKomisi: number;
    totalTransaksi: number;
    popularServices: PopularService[];
    produkTerlaris: ProdukTerlaris[];
    barberPerformance: BarberPerf[];
    dailyRevenue: DailyRevenue[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [attendance, setAttendance] = useState<AttendanceStaffRow[] | null>(null);
  const [attendanceError, setAttendanceError] = useState(false);

  const loadAttendance = useCallback(async () => {
    setAttendanceError(false);
    try {
      const res = await fetch(`/api/admin-reports/attendance?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Gagal memuat rekap absensi.");
      const json = await res.json();
      setAttendance(json.staff ?? []);
    } catch {
      setAttendanceError(true);
    }
  }, [from, to]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/admin-reports?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Gagal memuat laporan.");
      const json = await res.json();
      setData(json);
    } catch {
      setLoadError(true);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const maxRevenue = data ? Math.max(...data.dailyRevenue.map((d) => d.total), 1) : 1;

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Laporan</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Rekap omset, layanan terpopuler, dan performa barber.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            { key: "7d", label: "7 Hari" },
            { key: "30d", label: "30 Hari" },
            { key: "thisMonth", label: "Bulan Ini" },
            { key: "lastMonth", label: "Bulan Lalu" },
          ] as { key: DatePreset; label: string }[]
        ).map((p) => {
          const range = getPresetRange(p.key);
          const isActive = range.from === from && range.to === to;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setFrom(range.from);
                setTo(range.to);
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-accent text-black"
                  : "border border-border-soft bg-surface text-text-secondary hover:bg-surface-2"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Dari</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Sampai</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      {loadError && (
        <ErrorState
          className="mt-6"
          title="Gagal memuat laporan"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={load}
        />
      )}

      {!loadError && !data && (
        <p className="mt-8 text-sm text-text-secondary">Memuat laporan...</p>
      )}

      {!loadError && data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-border-soft bg-surface p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Wallet size={18} />
              </div>
              <p className="mt-3 text-xs text-text-secondary">Total Omset</p>
              <p className="font-display mt-1 text-2xl font-extrabold">
                {formatRupiah(data.totalOmset)}
              </p>
              <p className="mt-1 text-[11px] text-text-tertiary">
                Layanan {formatRupiah(data.totalOmsetLayanan)} · Produk {formatRupiah(data.totalOmsetProduk)}
              </p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <ShoppingBag size={18} />
              </div>
              <p className="mt-3 text-xs text-text-secondary">Total Transaksi Selesai</p>
              <p className="font-display mt-1 text-2xl font-extrabold">{data.totalTransaksi}</p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <HandCoins size={18} />
              </div>
              <p className="mt-3 text-xs text-text-secondary">Total Komisi Barber</p>
              <p className="font-display mt-1 text-2xl font-extrabold">
                {formatRupiah(data.totalKomisi)}
              </p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Store size={18} />
              </div>
              <p className="mt-3 text-xs text-text-secondary">Bagian Barbershop</p>
              <p className="font-display mt-1 text-2xl font-extrabold">
                {formatRupiah(data.totalOmset - data.totalKomisi)}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
            <h2 className="font-display text-sm font-bold">Omset Harian</h2>
            <div className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-2">
              {data.dailyRevenue.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-6 rounded-t-md bg-accent"
                    style={{ height: `${Math.max((d.total / maxRevenue) * 120, 4)}px` }}
                    title={formatRupiah(d.total)}
                  />
                  <span className="text-[9px] text-text-tertiary">
                    {formatDateShort(d.date)}
                  </span>
                </div>
              ))}
              {data.dailyRevenue.length === 0 && (
                <p className="text-sm text-text-secondary">Belum ada data pada rentang ini.</p>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div>
              <h2 className="font-display mb-3 text-sm font-bold">Layanan Terpopuler</h2>
              <div className="flex flex-col gap-2.5">
                {data.popularServices.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-text-secondary">{s.count}x dibooking</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">{formatRupiah(s.revenue)}</p>
                      {s.commission > 0 && (
                        <p className="text-[11px] text-text-tertiary">
                          Komisi {formatRupiah(s.commission)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {data.popularServices.length === 0 && (
                  <p className="text-sm text-text-secondary">Belum ada data.</p>
                )}
              </div>
            </div>

            {/* PRODUK TERLARIS — dari penjualan produk lewat Catat Cepat
                barber atau dicatat admin (tabel product_sales, TERPISAH
                dari booking layanan). Belum ada komisi barber untuk
                penjualan produk saat ini. */}
            <div>
              <h2 className="font-display mb-3 text-sm font-bold flex items-center gap-2">
                <Package size={14} className="text-accent" />
                Produk Terlaris
              </h2>
              <div className="flex flex-col gap-2.5">
                {data.produkTerlaris.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-text-secondary">{p.qty} terjual</p>
                    </div>
                    <p className="text-sm font-bold text-accent">{formatRupiah(p.revenue)}</p>
                  </div>
                ))}
                {data.produkTerlaris.length === 0 && (
                  <p className="text-sm text-text-secondary">Belum ada data.</p>
                )}
              </div>
            </div>

            <div>
              <h2 className="font-display mb-3 text-sm font-bold">Performa Barber</h2>
              <div className="flex flex-col gap-2.5">
                {data.barberPerformance.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{b.name}</p>
                      <p className="text-xs text-text-secondary">{b.count} klien</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">{formatRupiah(b.revenue)}</p>
                      {b.commission > 0 && (
                        <p className="text-[11px] text-text-tertiary">
                          Komisi {formatRupiah(b.commission)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {data.barberPerformance.length === 0 && (
                  <p className="text-sm text-text-secondary">Belum ada data.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Rekap Absensi Staff ── */}
          <div className="mt-8 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-bold flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-accent" />
                  Rekap Absensi Staff
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  Kehadiran, keterlambatan, dan total jam kerja pada rentang tanggal yang dipilih di atas — untuk bahan evaluasi.
                </p>
              </div>
              <Link href={`/admin/laporan-absensi?from=${from}&to=${to}`} target="_blank">
                <Button size="sm" variant="secondary" icon={<Printer size={14} />}>
                  Cetak Rekap
                </Button>
              </Link>
            </div>

            {attendanceError && (
              <ErrorState
                className="mt-4"
                title="Gagal memuat rekap absensi"
                message="Periksa koneksi internet kamu, lalu coba lagi."
                onRetry={loadAttendance}
              />
            )}

            {!attendanceError && attendance === null && (
              <p className="mt-4 text-sm text-text-secondary">Memuat rekap absensi...</p>
            )}

            {!attendanceError && attendance && attendance.length === 0 && (
              <p className="mt-4 text-sm text-text-secondary">Belum ada staff aktif.</p>
            )}

            {!attendanceError && attendance && attendance.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-soft text-xs text-text-secondary">
                      <th className="py-2 pr-3 font-semibold">Staff</th>
                      <th className="py-2 pr-3 font-semibold text-center">Hadir</th>
                      <th className="py-2 pr-3 font-semibold text-center">Terlambat</th>
                      <th className="py-2 pr-3 font-semibold text-center">Tidak Masuk</th>
                      <th className="py-2 pr-3 font-semibold text-right">Total Jam Kerja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((s) => (
                      <tr key={s.staff_id} className="border-b border-border-soft/60 last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{s.name}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                s.role === "admin" ? "bg-accent/15 text-accent" : "bg-border-soft text-text-secondary"
                              }`}
                            >
                              {s.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-center font-semibold text-status-done">{s.hadir}</td>
                        <td className="py-2.5 pr-3 text-center">
                          {s.terlambat > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                              <AlertTriangle size={12} />
                              {s.terlambat}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">0</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          {s.tidak_masuk > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-status-cancelled">
                              <UserX size={12} />
                              {s.tidak_masuk}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">0</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Clock3 size={12} className="text-text-tertiary" />
                            {formatJamKerja(s.total_jam_kerja_menit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { formatRupiah, formatDateShort } from "@/lib/utils";
import { ErrorState } from "@/components/ErrorState";
import { Wallet, ShoppingBag } from "lucide-react";

interface PopularService {
  name: string;
  count: number;
  revenue: number;
}
interface BarberPerf {
  name: string;
  count: number;
  revenue: number;
}
interface DailyRevenue {
  date: string;
  total: number;
}

export default function AdminLaporanPage() {
  const [from, setFrom] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{
    totalOmset: number;
    totalTransaksi: number;
    popularServices: PopularService[];
    barberPerformance: BarberPerf[];
    dailyRevenue: DailyRevenue[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

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

      <div className="mt-5 flex flex-wrap gap-3">
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
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border-soft bg-surface p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Wallet size={18} />
              </div>
              <p className="mt-3 text-xs text-text-secondary">Total Omset</p>
              <p className="font-display mt-1 text-2xl font-extrabold">
                {formatRupiah(data.totalOmset)}
              </p>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <ShoppingBag size={18} />
              </div>
              <p className="mt-3 text-xs text-text-secondary">Total Transaksi Selesai</p>
              <p className="font-display mt-1 text-2xl font-extrabold">{data.totalTransaksi}</p>
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

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
                    <p className="text-sm font-bold text-accent">{formatRupiah(s.revenue)}</p>
                  </div>
                ))}
                {data.popularServices.length === 0 && (
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
                    <p className="text-sm font-bold text-accent">{formatRupiah(b.revenue)}</p>
                  </div>
                ))}
                {data.barberPerformance.length === 0 && (
                  <p className="text-sm text-text-secondary">Belum ada data.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

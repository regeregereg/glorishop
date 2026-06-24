"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking } from "@/types";
import { ErrorState } from "@/components/ErrorState";
import { LinkButton } from "@/components/Button";
import { getBookingServiceNames, formatDateShort, formatTime, formatRupiah } from "@/lib/utils";
import { buildReceiptData } from "@/lib/receipt";
import { Receipt, FileText } from "lucide-react";

export default function AdminStrukPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/bookings?status=DONE");
      if (!res.ok) throw new Error("Gagal memuat data.");
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filter berdasarkan tanggal slot booking (fallback ke created_at untuk
  // booking lama tanpa slot), supaya cocok dengan tanggal pelanggan
  // benar-benar dilayani — bukan tanggal booking-nya dibuat di sistem.
  const filtered = bookings.filter((b) => {
    const dateKey = b.slot?.date ?? b.created_at.slice(0, 10);
    return dateKey >= from && dateKey <= to;
  });

  const totalOmset = filtered.reduce((sum, b) => sum + buildReceiptData(b).subtotal, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Struk Transaksi</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cetak atau download struk per transaksi, maupun rekap laporan harian.
          </p>
        </div>
        <LinkButton
          href={`/admin/laporan-harian?date=${to}`}
          icon={<FileText size={16} />}
          variant="secondary"
        >
          Laporan Harian
        </LinkButton>
      </div>

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
        <ErrorState className="mt-6" title="Gagal memuat data" message="Coba lagi." onRetry={load} />
      )}

      {!loadError && (
        <>
          <div className="mt-5 rounded-2xl border border-border-soft bg-surface px-4 py-3">
            <p className="text-xs text-text-secondary">Total omset pada rentang ini</p>
            <p className="font-display mt-0.5 text-xl font-extrabold text-accent">
              {formatRupiah(totalOmset)} · {filtered.length} transaksi
            </p>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-border-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-soft bg-surface text-left text-xs text-text-secondary">
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Layanan</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3 text-right">Struk</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const receipt = buildReceiptData(b);
                  return (
                    <tr key={b.id} className="border-b border-border-soft last:border-0">
                      <td className="px-4 py-3 font-semibold">
                        {b.user?.name ?? b.walkin_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{getBookingServiceNames(b)}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {b.slot ? `${formatDateShort(b.slot.date)} ${formatTime(b.slot.start_time)}` : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-accent">
                        {formatRupiah(receipt.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <LinkButton
                          href={`/admin/struk/${b.id}`}
                          size="sm"
                          variant="secondary"
                          icon={<Receipt size={13} />}
                        >
                          Cetak
                        </LinkButton>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                      Tidak ada transaksi selesai pada rentang ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Booking } from "@/types";
import { buildReceiptData } from "@/lib/receipt";
import { DailyReportDocument, DailyReportRow } from "@/components/DailyReportDocument";
import { PrintActions } from "@/components/PrintActions";
import { ErrorState } from "@/components/ErrorState";

const REPORT_ELEMENT_ID = "daily-report-print-area";

function LaporanHarianContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(dateParam);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
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

  const rows: DailyReportRow[] = bookings
    .filter((b) => {
      const dateKey = b.slot?.date ?? b.created_at.slice(0, 10);
      return dateKey === date;
    })
    .map((booking) => ({ booking, receipt: buildReceiptData(booking) }))
    .sort((a, b) => a.receipt.timeLabel.localeCompare(b.receipt.timeLabel));

  const totalOmset = rows.reduce((sum, r) => sum + r.receipt.subtotal, 0);
  const totalKomisi = rows.reduce((sum, r) => sum + r.receipt.totalCommission, 0);
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-bg">
      <PrintActions
        targetId={REPORT_ELEMENT_ID}
        fileName={`Laporan-Harian-${date}`}
        paperSize="a4"
        onPaperSizeChange={() => {}}
        showPaperSizePicker={false}
        backHref="/admin/struk"
      />

      <div className="no-print flex justify-center px-4 pt-4">
        <div>
          <label className="mb-1 block text-xs text-text-secondary">Pilih tanggal</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      {loading && <p className="p-6 text-center text-sm text-text-secondary">Memuat laporan...</p>}

      {loadError && (
        <div className="p-6">
          <ErrorState title="Gagal memuat laporan" message="Coba lagi." onRetry={load} />
        </div>
      )}

      {!loading && !loadError && (
        <div className="px-4 py-8">
          <DailyReportDocument
            dateLabel={dateLabel}
            rows={rows}
            totalOmset={totalOmset}
            totalKomisi={totalKomisi}
          />
        </div>
      )}
    </div>
  );
}

export default function LaporanHarianPage() {
  // useSearchParams butuh Suspense boundary di Next.js App Router supaya
  // tidak membuat seluruh halaman jadi fully client-rendered tanpa batas.
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-text-secondary">Memuat...</p>}>
      <LaporanHarianContent />
    </Suspense>
  );
}

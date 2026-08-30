"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  FullReportDocument,
  PopularServiceRow,
  ProdukTerlarisRow,
  BarberPerfRow,
  DailyRevenueRow,
} from "@/components/FullReportDocument";
import { AttendanceReportRow } from "@/components/AttendanceReportDocument";
import { PrintActions } from "@/components/PrintActions";
import { ErrorState } from "@/components/ErrorState";

const REPORT_ELEMENT_ID = "full-report-print-area";

interface ReportSummary {
  totalOmset: number;
  totalOmsetLayanan: number;
  totalOmsetProduk: number;
  totalKomisi: number;
  totalTransaksi: number;
  popularServices: PopularServiceRow[];
  produkTerlaris: ProdukTerlarisRow[];
  barberPerformance: BarberPerfRow[];
  dailyRevenue: DailyRevenueRow[];
}

function LaporanLengkapContent() {
  const searchParams = useSearchParams();
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const fromParam = searchParams.get("from") || todayStr;
  const toParam = searchParams.get("to") || todayStr;

  const [from, setFrom] = useState(fromParam);
  const [to, setTo] = useState(toParam);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceReportRow[]>([]);
  const [workStartTime, setWorkStartTime] = useState("09:00");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const [reportRes, attendanceRes] = await Promise.all([
        fetch(`/api/admin-reports?from=${from}&to=${to}`),
        fetch(`/api/admin-reports/attendance?from=${from}&to=${to}`),
      ]);
      if (!reportRes.ok || !attendanceRes.ok) throw new Error("Gagal memuat data.");

      const reportJson = await reportRes.json();
      const attendanceJson = await attendanceRes.json();

      setSummary(reportJson);
      setAttendance(attendanceJson.staff ?? []);
      setWorkStartTime(attendanceJson.work_start_time ?? "09:00");
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const periodLabel =
    from === to
      ? formatTanggalPanjang(from)
      : `${formatTanggalPanjang(from)} — ${formatTanggalPanjang(to)}`;

  return (
    <div className="min-h-screen bg-bg">
      <PrintActions
        targetId={REPORT_ELEMENT_ID}
        fileName={`Laporan-Lengkap-${from}_${to}`}
        paperSize="a4"
        onPaperSizeChange={() => {}}
        showPaperSizePicker={false}
        backHref="/admin/laporan"
      />

      <div className="no-print flex flex-wrap justify-center gap-3 px-4 pt-4">
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

      {loading && <p className="p-6 text-center text-sm text-text-secondary">Memuat laporan lengkap...</p>}

      {loadError && (
        <div className="p-6">
          <ErrorState title="Gagal memuat laporan" message="Coba lagi." onRetry={load} />
        </div>
      )}

      {!loading && !loadError && summary && (
        <div className="px-4 py-8">
          <FullReportDocument
            periodLabel={periodLabel}
            summary={{
              totalOmset: summary.totalOmset,
              totalOmsetLayanan: summary.totalOmsetLayanan,
              totalOmsetProduk: summary.totalOmsetProduk,
              totalKomisi: summary.totalKomisi,
              totalTransaksi: summary.totalTransaksi,
            }}
            dailyRevenue={summary.dailyRevenue}
            popularServices={summary.popularServices}
            produkTerlaris={summary.produkTerlaris}
            barberPerformance={summary.barberPerformance}
            workStartTime={workStartTime}
            attendance={attendance}
          />
        </div>
      )}
    </div>
  );
}

function formatTanggalPanjang(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function LaporanLengkapPage() {
  // useSearchParams butuh Suspense boundary di Next.js App Router.
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm text-text-secondary">Memuat...</p>}>
      <LaporanLengkapContent />
    </Suspense>
  );
}

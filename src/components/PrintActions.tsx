"use client";

import { useState } from "react";
import { Printer, Download, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReceiptPaperSize, PAPER_SIZE_LABELS } from "@/lib/receipt";
import { formatRupiah } from "@/lib/utils";

// Toolbar aksi yang dipakai di halaman struk individual & laporan harian.
// Disembunyikan otomatis saat print (class "no-print", lihat globals.css)
// supaya tombol-tombol ini tidak ikut tercetak/masuk ke screenshot PDF.
//
// targetId = id elemen DOM yang akan di-capture jadi gambar untuk PDF
// (lihat downloadElementAsPdf di src/lib/pdf-capture.ts).
export function PrintActions({
  targetId,
  fileName,
  paperSize,
  onPaperSizeChange,
  showPaperSizePicker = true,
  cashInput,
}: {
  targetId: string;
  fileName: string;
  paperSize: ReceiptPaperSize;
  onPaperSizeChange: (size: ReceiptPaperSize) => void;
  showPaperSizePicker?: boolean;
  // Kotak input "Uang Diterima" + kembalian otomatis — opsional, hanya
  // dipakai di halaman struk satu booking (bukan di laporan harian).
  cashInput?: {
    amountDue: number; // basis kembalian: total ATAU sisa DP, lihat getCashDueAmount()
    value: string;
    onChange: (value: string) => void;
  };
}) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  async function handleDownloadPdf() {
    setDownloadError(false);
    setDownloading(true);
    try {
      // Import dinamis: html2canvas + jsPDF cukup besar, tidak perlu masuk
      // ke bundle halaman lain yang tidak butuh fitur download PDF.
      const { downloadElementAsPdf } = await import("@/lib/pdf-capture");
      await downloadElementAsPdf(targetId, fileName, paperSize);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  const tenderedNum = cashInput ? Number(cashInput.value.replace(/\D/g, "")) || 0 : 0;
  const change = cashInput ? tenderedNum - cashInput.amountDue : 0;

  return (
    <div className="no-print sticky top-0 z-20 flex flex-col gap-3 border-b border-border-soft bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface"
        >
          <ArrowLeft size={14} />
          Kembali
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {showPaperSizePicker && (
            <select
              value={paperSize}
              onChange={(e) => onPaperSizeChange(e.target.value as ReceiptPaperSize)}
              className="rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent"
            >
              {Object.entries(PAPER_SIZE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface"
          >
            <Printer size={14} />
            Print
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="btn-order-gradient flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? "Menyiapkan..." : "Download PDF"}
          </button>
        </div>

        {downloadError && (
          <p className="w-full text-xs text-status-cancelled">
            Gagal membuat PDF. Coba lagi, atau gunakan tombol Print lalu pilih &quot;Save as PDF&quot; di dialog print.
          </p>
        )}
      </div>

      {cashInput && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            Uang Diterima
            <input
              type="text"
              inputMode="numeric"
              placeholder={`min. ${formatRupiah(cashInput.amountDue)}`}
              value={cashInput.value}
              onChange={(e) => cashInput.onChange(e.target.value.replace(/\D/g, ""))}
              className="w-40 rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-accent"
            />
          </label>

          {cashInput.value !== "" && (
            <p
              className={`text-xs font-bold ${
                change < 0 ? "text-status-cancelled" : "text-text-primary"
              }`}
            >
              {change < 0
                ? `Kurang ${formatRupiah(Math.abs(change))}`
                : `Kembalian: ${formatRupiah(change)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

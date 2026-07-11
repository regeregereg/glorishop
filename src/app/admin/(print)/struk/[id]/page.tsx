"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Booking } from "@/types";
import { buildReceiptData, getCashDueAmount, ReceiptPaperSize } from "@/lib/receipt";
import { ReceiptDocument } from "@/components/ReceiptDocument";
import { PrintActions } from "@/components/PrintActions";
import { ErrorState } from "@/components/ErrorState";

const RECEIPT_ELEMENT_ID = "receipt-print-area";

export default function StrukDetailPage() {
  const params = useParams();
  const bookingId = params?.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [paperSize, setPaperSize] = useState<ReceiptPaperSize>("thermal58");
  // Uang tunai yang diterima kasir, diisi manual sesaat di halaman ini saja
  // (tidak disimpan ke booking) — basis kembaliannya beda-beda tergantung
  // ada/tidaknya DP, lihat getCashDueAmount() di lib/receipt.ts.
  const [cashInputValue, setCashInputValue] = useState("");

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error("Gagal memuat data booking.");
      const data = await res.json();
      if (!data.booking) throw new Error("Booking tidak ditemukan.");
      setBooking(data.booking);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="p-6 text-center text-sm text-text-secondary">Memuat struk...</p>;
  }

  if (loadError || !booking) {
    return (
      <div className="p-6">
        <ErrorState
          title="Gagal memuat struk"
          message="Booking tidak ditemukan atau terjadi kesalahan. Coba lagi."
          onRetry={load}
        />
      </div>
    );
  }

  const receiptData = buildReceiptData(booking);
  const cashDue = getCashDueAmount(receiptData);
  const tenderedNum = cashInputValue !== "" ? Number(cashInputValue) : null;

  return (
    <div className="min-h-screen bg-bg">
      <PrintActions
        targetId={RECEIPT_ELEMENT_ID}
        fileName={`Struk-${receiptData.receiptNumber}`}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
        backHref="/admin/struk"
        cashInput={
          cashDue != null
            ? { amountDue: cashDue, value: cashInputValue, onChange: setCashInputValue }
            : undefined
        }
      />
      <div className="px-4 py-8">
        <ReceiptDocument
          data={receiptData}
          paperSize={paperSize}
          amountTendered={tenderedNum}
          changeAmount={tenderedNum != null && cashDue != null ? tenderedNum - cashDue : null}
        />
      </div>
    </div>
  );
}

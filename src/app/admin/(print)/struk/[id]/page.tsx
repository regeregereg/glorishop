"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Booking } from "@/types";
import { buildReceiptData, ReceiptPaperSize } from "@/lib/receipt";
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

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      // Tidak ada endpoint GET /api/bookings/[id] untuk satu booking saja,
      // jadi ambil semua booking lalu cari yang cocok di sisi klien — daftar
      // ini sudah di-fetch admin di halaman lain juga, ukurannya wajar untuk
      // skala satu barbershop (bukan ribuan baris).
      const res = await fetch("/api/bookings");
      if (!res.ok) throw new Error("Gagal memuat data booking.");
      const data = await res.json();
      const found = (data.bookings || []).find((b: Booking) => b.id === bookingId);
      if (!found) throw new Error("Booking tidak ditemukan.");
      setBooking(found);
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

  return (
    <div className="min-h-screen bg-bg">
      <PrintActions
        targetId={RECEIPT_ELEMENT_ID}
        fileName={`Struk-${receiptData.receiptNumber}`}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
      />
      <div className="px-4 py-8">
        <ReceiptDocument data={receiptData} paperSize={paperSize} />
      </div>
    </div>
  );
}

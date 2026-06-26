// Helper terpusat untuk fitur struk/bukti transaksi (cetak & download PDF).
// Lihat src/components/ReceiptDocument.tsx untuk komponen tampilan struknya,
// dan src/app/admin/(print)/struk untuk halaman-halaman yang memakainya.
//
// Struk dibangun dari data Booking yang SUDAH ada (booking_services, payment,
// dst — lihat GET /api/bookings) supaya tidak perlu tabel "transactions"
// baru: satu booking dengan status DONE = satu transaksi yang bisa dicetak.

import { Booking } from "@/types";
import { recalcRowCommission } from "@/lib/commission";

export interface ReceiptLineItem {
  name: string;
  price: number;
  commission: number;
}

export interface ReceiptData {
  receiptNumber: string;
  bookingCode: string | null; // kode booking pendek untuk verifikasi (GLR-XXXXXX)
  booking: Booking;
  customerName: string;
  barberName: string;
  dateLabel: string; // "24 Jun 2026"
  timeLabel: string; // "14.30"
  items: ReceiptLineItem[];
  subtotal: number;
  totalCommission: number;
  paymentTypeLabel: string | null; // "DP 50%" / "Lunas (Full)" / null kalau walk-in tanpa data payment
  paidUpfront: number | null; // nominal yang sudah dibayar di muka (DP/Full), null kalau walk-in di tempat
  remaining: number; // sisa yang dibayar di tempat (0 kalau sudah lunas via DP Full atau walk-in)
}

// Nomor struk pendek & stabil dari UUID booking, contoh:
// id "a1b2c3d4-..." + created_at "2026-06-24" -> "GB-260624-A1B2C3D4"
// Diturunkan dari data yang sudah ada (tidak perlu kolom baru di DB) supaya
// tetap konsisten dipakai ulang setiap kali struk yang sama dicetak ulang.
export function buildReceiptNumber(booking: Booking): string {
  const created = new Date(booking.created_at);
  const yy = created.getFullYear().toString().slice(2);
  const mm = (created.getMonth() + 1).toString().padStart(2, "0");
  const dd = created.getDate().toString().padStart(2, "0");
  const shortId = booking.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `GB-${yy}${mm}${dd}-${shortId}`;
}

function formatClockFromTimeStr(timeStr: string): string {
  // "HH:MM:SS" / "HH:MM" -> "HH.MM" (format jam ala Indonesia, pakai titik)
  return timeStr.slice(0, 5).replace(":", ".");
}

/**
 * Susun semua data siap-tampil untuk struk satu booking. Tidak melempar
 * error untuk data yang tidak lengkap (mis. booking lama tanpa slot) —
 * field terkait cukup ditampilkan sebagai "—" di komponen tampilan.
 */
export function buildReceiptData(booking: Booking): ReceiptData {
  const items: ReceiptLineItem[] =
    booking.services && booking.services.length > 0
      ? booking.services.map((s) => ({
          name: s.service_name,
          price:
            s.final_price ?? s.service_price ?? s.service_price_min ?? 0,
          commission: s.commission_amount ?? recalcRowCommission(s),
        }))
      : booking.service
        ? [
            {
              name: booking.service.name,
              price: booking.final_price ?? booking.service.price ?? booking.service.price_min ?? 0,
              commission: 0,
            },
          ]
        : [];

  const subtotal = booking.final_price ?? items.reduce((sum, it) => sum + it.price, 0);
  const totalCommission = items.reduce((sum, it) => sum + it.commission, 0);

  const dateLabel = booking.slot
    ? new Date(booking.slot.date + "T00:00:00").toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date(booking.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  const timeLabel = booking.slot ? formatClockFromTimeStr(booking.slot.start_time) : "—";

  let paymentTypeLabel: string | null = null;
  let paidUpfront: number | null = null;
  let remaining = 0;

  if (booking.payment && booking.payment.status === "CONFIRMED") {
    paymentTypeLabel = booking.payment.payment_type === "FULL" ? "Lunas (Bayar Penuh)" : "DP (Bayar Sebagian)";
    paidUpfront = booking.payment.amount;
    remaining = Math.max(subtotal - paidUpfront, 0);
  } else {
    // Tidak ada record payment terverifikasi -> walk-in / dibayar tunai
    // langsung di tempat, dianggap lunas saat itu juga.
    paymentTypeLabel = "Tunai di Tempat";
    paidUpfront = null;
    remaining = 0;
  }

  return {
    receiptNumber: buildReceiptNumber(booking),
    bookingCode: booking.booking_code ?? null,
    booking,
    customerName: booking.user?.name ?? booking.walkin_name ?? "Pelanggan",
    barberName: booking.barber?.name ?? "—",
    dateLabel,
    timeLabel,
    items,
    subtotal,
    totalCommission,
    paymentTypeLabel,
    paidUpfront,
    remaining,
  };
}

export type ReceiptPaperSize = "thermal58" | "thermal80" | "a4";

export const PAPER_SIZE_LABELS: Record<ReceiptPaperSize, string> = {
  thermal58: "Thermal 58mm",
  thermal80: "Thermal 80mm",
  a4: "A4 / Surat",
};

// Nominal yang harus dibayar TUNAI saat ini juga (dipakai untuk hitung
// kembalian di halaman struk). Aturan:
// - Kalau sudah lunas via DP Full (remaining === 0) -> tidak ada uang cash
//   yang berpindah tangan sekarang, jadi null (input kembalian disembunyikan).
// - Kalau ada DP tapi masih ada sisa -> basisnya SISA di tempat saja.
// - Kalau tanpa DP sama sekali (walk-in/tunai langsung) -> basisnya TOTAL.
export function getCashDueAmount(data: ReceiptData): number | null {
  if (data.paidUpfront != null) {
    return data.remaining > 0 ? data.remaining : null;
  }
  return data.subtotal;
}

import { Service, PaymentType } from "@/types";

export const PAYMENT_TIMEOUT_MINUTES = 30;
export const DEFAULT_DP_PERCENTAGE = 50;

/**
 * Hitung harga acuan layanan untuk dasar pembayaran.
 * Untuk layanan dengan range harga (price_min/price_max), pakai price_min
 * sebagai acuan minimal (final_price akan disesuaikan barber setelah selesai,
 * sisa pembayaran range ditagih langsung di tempat).
 */
export function getServiceBasePrice(service: Pick<Service, "price" | "price_min">): number {
  if (service.price != null) return service.price;
  if (service.price_min != null) return service.price_min;
  return 0;
}

/**
 * Versi multi-layanan dari getServiceBasePrice: jumlahkan harga acuan dari
 * semua layanan yang dipilih pelanggan dalam satu booking.
 */
export function getServicesBasePrice(services: Pick<Service, "price" | "price_min">[]): number {
  return services.reduce((sum, s) => sum + getServiceBasePrice(s), 0);
}

/**
 * Hitung nominal yang wajib dibayar di muka berdasarkan jenis pembayaran.
 */
export function calculatePaymentAmount(
  basePrice: number,
  paymentType: PaymentType,
  dpPercentage: number = DEFAULT_DP_PERCENTAGE
): number {
  if (paymentType === "FULL") return basePrice;
  return Math.ceil((basePrice * dpPercentage) / 100);
}

export function getPaymentExpiryDate(fromDate: Date = new Date()): Date {
  return new Date(fromDate.getTime() + PAYMENT_TIMEOUT_MINUTES * 60 * 1000);
}

export function isPaymentExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Hitung total harga sebuah booking untuk keperluan laporan/statistik.
 * Urutan prioritas:
 * 1. booking.final_price (kalau admin/barber sudah set harga final gabungan secara manual)
 * 2. jumlah booking_services[].final_price kalau SEMUA baris sudah punya final_price
 * 3. jumlah harga acuan (price / price_min) dari booking_services (multi-layanan)
 * 4. fallback ke relasi service tunggal lama (booking lama / belum migrasi)
 */
export function getBookingTotalPrice(booking: {
  final_price?: number | null;
  services?: { final_price?: number | null; service_price?: number | null; service_price_min?: number | null }[];
  // Supabase (tanpa generated DB types) kadang men-tipe-kan relasi to-one
  // "service:services(...)" sebagai ARRAY, bukan objek tunggal, meskipun
  // isinya cuma 1 baris — makanya di sini diterima keduanya (objek ATAU
  // array) dan diratakan di bawah, sama seperti relasi lain (payment, dll)
  // yang sudah lebih dulu ditangani dengan pola ini di tempat lain.
  service?:
    | { price?: number | null; price_min?: number | null }
    | { price?: number | null; price_min?: number | null }[]
    | null;
}): number {
  if (booking.final_price != null) return booking.final_price;

  if (booking.services && booking.services.length > 0) {
    const allHaveFinal = booking.services.every((s) => s.final_price != null);
    if (allHaveFinal) {
      return booking.services.reduce((sum, s) => sum + (s.final_price ?? 0), 0);
    }
    return booking.services.reduce((sum, s) => {
      if (s.final_price != null) return sum + s.final_price;
      if (s.service_price != null) return sum + s.service_price;
      if (s.service_price_min != null) return sum + s.service_price_min;
      return sum;
    }, 0);
  }

  const singleService = Array.isArray(booking.service) ? booking.service[0] : booking.service;
  if (singleService) {
    if (singleService.price != null) return singleService.price;
    if (singleService.price_min != null) return singleService.price_min;
  }

  return 0;
}

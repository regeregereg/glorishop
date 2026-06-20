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

// Resolusi harga EFEKTIF sebuah layanan untuk barber tertentu.
//
// ATURAN (sesuai keputusan owner):
// - Defaultnya semua barber pakai harga dasar layanan (services.price /
//   price_min / price_max).
// - Admin BISA override per layanan, per barber lewat tabel
//   service_barber_prices (lihat supabase/migration_barber_service_prices.sql).
//   Diisi satu-satu di tabel oleh admin — bukan persentase/formula otomatis.
// - Bentuk override mengikuti tipe harga layanan ASLINYA: layanan harga
//   tetap -> override harga tetap; layanan harga range -> override range.
//   Kalau override tidak lengkap (mis. layanan range tapi admin hanya isi
//   salah satu dari price_min/price_max), baris itu diperlakukan TIDAK
//   valid dan fallback total ke harga dasar — supaya tidak ada harga
//   "nanggung" yang setengah dari override setengah dari dasar.
// - Booking TANPA barber spesifik ("Tanpa Preferensi") SELALU pakai harga
//   dasar, walau salah satu barber yang nanti mengerjakan punya override.
//   Ini dijaga oleh caller (jangan panggil getEffectivePrice dengan
//   barberId saat pelanggan belum pilih barber), bukan oleh fungsi ini.

import { Service, ServiceBarberPrice } from "@/types";

export interface EffectivePrice {
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  // true kalau harga ini hasil override khusus barber (bukan harga dasar)
  is_override: boolean;
}

/**
 * Cari baris override (kalau ada & valid) untuk kombinasi service+barber,
 * dari daftar barber_prices yang sudah di-join ke objek Service.
 */
function findValidOverride(
  service: Pick<Service, "price" | "price_min" | "price_max">,
  barberPrices: ServiceBarberPrice[] | undefined,
  barberId: string
): ServiceBarberPrice | null {
  if (!barberPrices || barberPrices.length === 0) return null;
  const row = barberPrices.find((p) => p.barber_id === barberId);
  if (!row) return null;

  const isRangeService = service.price_min != null && service.price_max != null;

  if (isRangeService) {
    // Layanan range -> override HARUS mengisi price_min DAN price_max
    // sekaligus untuk dianggap valid. Mengisi salah satu saja diabaikan.
    if (row.price_min != null && row.price_max != null) return row;
    return null;
  }

  // Layanan harga tetap -> override harus mengisi price.
  if (row.price != null) return row;
  return null;
}

/**
 * Hitung harga efektif satu layanan untuk barber tertentu (atau harga
 * dasar kalau barberId null/undefined — dipakai untuk "Tanpa Preferensi").
 */
export function getEffectivePrice(
  service: Pick<Service, "price" | "price_min" | "price_max" | "barber_prices">,
  barberId: string | null | undefined
): EffectivePrice {
  if (!barberId) {
    return {
      price: service.price ?? null,
      price_min: service.price_min ?? null,
      price_max: service.price_max ?? null,
      is_override: false,
    };
  }

  const override = findValidOverride(service, service.barber_prices, barberId);
  if (!override) {
    return {
      price: service.price ?? null,
      price_min: service.price_min ?? null,
      price_max: service.price_max ?? null,
      is_override: false,
    };
  }

  const isRangeService = service.price_min != null && service.price_max != null;
  return isRangeService
    ? { price: null, price_min: override.price_min, price_max: override.price_max, is_override: true }
    : { price: override.price, price_min: null, price_max: null, is_override: true };
}

/**
 * Versi "harga acuan tunggal" (sama seperti getServiceBasePrice di
 * lib/payment.ts) tapi sudah memperhitungkan override per barber: harga
 * tetap -> dipakai langsung; harga range -> pakai batas bawah (price_min)
 * sebagai acuan minimal, konsisten dengan aturan dasar pembayaran.
 */
export function getEffectiveBasePrice(
  service: Pick<Service, "price" | "price_min" | "price_max" | "barber_prices">,
  barberId: string | null | undefined
): number {
  const eff = getEffectivePrice(service, barberId);
  if (eff.price != null) return eff.price;
  if (eff.price_min != null) return eff.price_min;
  return 0;
}

/**
 * Versi multi-layanan: jumlahkan harga acuan EFEKTIF (sudah memperhitungkan
 * override barber) dari semua layanan yang dipilih dalam satu booking.
 * Semua layanan dalam satu booking memakai barber yang sama, jadi barberId
 * cukup satu untuk seluruh daftar.
 */
export function getEffectiveServicesBasePrice(
  services: Pick<Service, "price" | "price_min" | "price_max" | "barber_prices">[],
  barberId: string | null | undefined
): number {
  return services.reduce((sum, s) => sum + getEffectiveBasePrice(s, barberId), 0);
}

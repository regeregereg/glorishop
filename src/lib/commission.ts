// Helper terpusat untuk perhitungan komisi/bagi hasil barber per layanan.
// Lihat supabase/migration_walkin_homeservice_commission.sql untuk skema.
//
// ATURAN:
// - Persentase komisi diatur PER LAYANAN oleh admin (services.commission_percentage),
//   berlaku SAMA untuk semua barber yang mengerjakan layanan tersebut.
// - Persentase di-snapshot ke booking_services.commission_percentage saat
//   booking dibuat, supaya histori komisi booking lama tidak ikut berubah
//   kalau admin mengubah persentase layanan di kemudian hari.
// - commission_amount dihitung dari harga FINAL layanan tersebut (final_price
//   kalau sudah dikonfirmasi barber, atau harga acuan/estimasi sebelum itu).

export function calculateCommissionAmount(
  priceForCommission: number,
  commissionPercentage: number | null | undefined
): number {
  if (!commissionPercentage || commissionPercentage <= 0) return 0;
  return Math.round((priceForCommission * commissionPercentage) / 100);
}

/**
 * Ambil harga acuan satu baris booking_services untuk dasar hitung komisi:
 * final_price (kalau sudah dikonfirmasi) > service_price (harga tetap) >
 * service_price_min (estimasi minimal untuk layanan range).
 */
export function getRowPriceForCommission(row: {
  final_price?: number | null;
  service_price?: number | null;
  service_price_min?: number | null;
}): number {
  if (row.final_price != null) return row.final_price;
  if (row.service_price != null) return row.service_price;
  if (row.service_price_min != null) return row.service_price_min;
  return 0;
}

/**
 * Hitung ulang commission_amount untuk satu baris booking_services,
 * menggunakan commission_percentage yang SUDAH di-snapshot di baris itu
 * (bukan ambil ulang dari tabel services — supaya konsisten dengan aturan
 * snapshot di atas).
 */
export function recalcRowCommission(row: {
  final_price?: number | null;
  service_price?: number | null;
  service_price_min?: number | null;
  commission_percentage?: number | null;
}): number {
  const price = getRowPriceForCommission(row);
  return calculateCommissionAmount(price, row.commission_percentage);
}

/**
 * Jumlahkan total komisi dari semua booking_services dalam satu booking.
 */
export function getBookingTotalCommission(booking: {
  services?: {
    final_price?: number | null;
    service_price?: number | null;
    service_price_min?: number | null;
    commission_percentage?: number | null;
    commission_amount?: number | null;
  }[];
}): number {
  if (!booking.services || booking.services.length === 0) return 0;
  return booking.services.reduce((sum, s) => {
    if (s.commission_amount != null) return sum + s.commission_amount;
    return sum + recalcRowCommission(s);
  }, 0);
}

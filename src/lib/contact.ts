/**
 * Info kontak & lokasi Glori Barbershop — terpusat di sini supaya kalau
 * nomor WA, link Instagram, atau lokasi berubah, cukup diedit di satu
 * tempat tanpa harus cari-cari ke banyak file.
 */

// Nomor WhatsApp admin, format internasional tanpa "+" atau "0" di depan
// (62 = kode negara Indonesia), supaya valid dipakai di link wa.me.
export const WHATSAPP_NUMBER = "6281386856074";

export const INSTAGRAM_URL = "https://www.instagram.com/glori.barbershop/";

// Koordinat lokasi toko, dipakai untuk link Google Maps.
export const MAPS_LATITUDE = -7.371151;
export const MAPS_LONGITUDE = 108.8694524;
export const MAPS_URL = `https://www.google.com/maps?q=${MAPS_LATITUDE},${MAPS_LONGITUDE}`;

/**
 * Bangun link WhatsApp dengan pesan template opsional. Pesan otomatis
 * di-encode supaya aman dipakai di URL (spasi, tanda baca, dll).
 */
export function buildWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

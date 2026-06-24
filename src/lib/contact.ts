/**
 * Info kontak & lokasi Glori Barbershop — terpusat di sini supaya kalau
 * nomor WA, link Instagram, atau lokasi berubah, cukup diedit di satu
 * tempat tanpa harus cari-cari ke banyak file.
 */

// Nomor WhatsApp admin, format internasional tanpa "+" atau "0" di depan
// (62 = kode negara Indonesia), supaya valid dipakai di link wa.me.
export const WHATSAPP_NUMBER = "6281575982896";

export const INSTAGRAM_URL = "https://www.instagram.com/glori.barbershop/";

// Koordinat lokasi toko, dipakai untuk link Google Maps & structured data.
export const MAPS_LATITUDE = -7.371151;
export const MAPS_LONGITUDE = 108.8694524;
export const MAPS_URL = `https://www.google.com/maps?q=${MAPS_LATITUDE},${MAPS_LONGITUDE}`;

// Alamat tertulis — dipakai di JSON-LD structured data (schema.org
// PostalAddress) supaya Google & AI assistant bisa mengenali ini sebagai
// bisnis lokal yang valid saat orang mencari "barber terdekat" di area ini.
// Nama jalan & kode pos spesifik belum ada (domain custom & alamat detail
// masih difinalkan dengan owner) — field yang sudah pasti diisi penuh,
// field yang belum pasti diisi seakurat mungkin berdasarkan kecamatan resmi.
export const BUSINESS_ADDRESS = {
  streetAddress: "Jl. Raya Cikondang, Panimbang",
  addressLocality: "Cikondang",
  addressRegion: "Jawa Tengah",
  addressCountry: "ID",
  postalCode: "53256",
};
export const BUSINESS_CITY = "Kabupaten Cilacap";

// URL situs production — dipakai untuk metadataBase, sitemap, canonical URL,
// dan structured data. Domain custom belum final saat ini, jadi nilainya
// diambil dari env var NEXT_PUBLIC_SITE_URL supaya begitu domain final
// ditentukan, tinggal ganti env var di hosting (Vercel dll), TIDAK perlu
// edit kode sama sekali. Fallback di bawah ini HANYA dipakai kalau env var
// belum diset (mis. saat development lokal) — ganti env var sebelum
// deploy production untuk SEO yang akurat.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://glori-barbershop.vercel.app";

export const BUSINESS_NAME = "Glori Barbershop";
export const BUSINESS_DESCRIPTION =
  "Glori Barbershop adalah barbershop premium di Cikondang, Cimanggu, Kabupaten Cilacap — booking online untuk haircut, treatment, dan colouring tanpa antri.";

// Jam operasional toko — buka setiap hari (Senin-Minggu) 10:00-21:00,
// tanpa hari libur. Dipakai di structured data (openingHoursSpecification)
// supaya Google menampilkan info "Buka/Tutup" yang akurat. Kalau jam ini
// berubah di kemudian hari, cukup edit di sini saja.
export const OPENING_HOURS = {
  opens: "10:00",
  closes: "21:00",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

/**
 * Bangun link WhatsApp dengan pesan template opsional. Pesan otomatis
 * di-encode supaya aman dipakai di URL (spasi, tanda baca, dll).
 */
export function buildWhatsAppUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Alamat lengkap untuk ditampilkan di UI (header Home, footer, dsb)
export const BUSINESS_FULL_ADDRESS = "Jl. Raya Cikondang, Panimbang, Cimanggu, Cilacap";

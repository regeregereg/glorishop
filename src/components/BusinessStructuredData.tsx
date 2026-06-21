import {
  SITE_URL,
  BUSINESS_NAME,
  BUSINESS_DESCRIPTION,
  BUSINESS_ADDRESS,
  MAPS_LATITUDE,
  MAPS_LONGITUDE,
  WHATSAPP_NUMBER,
  INSTAGRAM_URL,
  OPENING_HOURS,
} from "@/lib/contact";

/**
 * Structured data (JSON-LD) schema.org untuk Glori Barbershop, ditaruh di
 * Home (halaman publik utama) supaya Google dan AI assistant (yang makin
 * banyak membaca structured data untuk menjawab pertanyaan seperti
 * "rekomendasi barber terdekat di Cilacap") bisa memahami konteks bisnis
 * ini secara mesin-terbaca, bukan cuma dari teks biasa.
 *
 * Pakai type "HairSalon" — subtype LocalBusiness yang lebih spesifik dan
 * dikenal Google khusus untuk salon/barbershop (lihat daftar resmi
 * schema.org/HairSalon), lebih akurat daripada LocalBusiness generik.
 *
 * @param avgRating - rata-rata rating dari seluruh review yang ada (opsional,
 *   diisi dari database saat Home dirender; kalau belum ada review sama
 *   sekali, field aggregateRating sengaja DIHILANGKAN — bukan diisi
 *   default/asumsi, karena schema.org AggregateRating dengan data palsu
 *   melanggar pedoman structured data Google dan bisa berakibat penalti).
 * @param reviewCount - jumlah review yang menjadi basis avgRating di atas.
 */
export function BusinessStructuredData({
  avgRating,
  reviewCount,
}: {
  avgRating?: number | null;
  reviewCount?: number;
}) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": `${SITE_URL}/#business`,
    name: BUSINESS_NAME,
    description: BUSINESS_DESCRIPTION,
    url: SITE_URL,
    telephone: `+${WHATSAPP_NUMBER}`,
    priceRange: "Rp15.000 - Rp150.000",
    image: `${SITE_URL}/og-image.png`,
    sameAs: [INSTAGRAM_URL],
    address: {
      "@type": "PostalAddress",
      ...BUSINESS_ADDRESS,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: MAPS_LATITUDE,
      longitude: MAPS_LONGITUDE,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: OPENING_HOURS.days,
      opens: OPENING_HOURS.opens,
      closes: OPENING_HOURS.closes,
    },
  };

  // Hanya disertakan kalau memang ada review sungguhan di database —
  // lihat catatan di komentar fungsi di atas.
  if (avgRating != null && reviewCount && reviewCount > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(avgRating.toFixed(1)),
      reviewCount,
    };
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

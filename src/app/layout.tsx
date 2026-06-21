import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_URL, BUSINESS_NAME, BUSINESS_DESCRIPTION } from "@/lib/contact";

// Font display resmi Glori Barbershop. File .woff2 disimpan langsung di
// repo (src/app/fonts/) dan dimuat lewat next/font/local supaya:
// - Konsisten di semua device (sebelumnya globals.css menetapkan "Avenir Next",
//   yang HANYA tersedia di macOS/iOS — di Windows/Android otomatis fallback
//   ke font sistem yang berbeda-beda, jadi judul/nama barber/harga terlihat
//   tidak konsisten antar perangkat).
// - Tidak butuh koneksi ke Google Fonts saat build (beberapa environment CI
//   memblokir fonts.googleapis.com), sekaligus paling cepat karena file
//   sudah ada lokal — Next.js tetap mengoptimasi & self-host secara otomatis.
// - Lisensi: SIL Open Font License 1.1 (lihat src/app/fonts/OFL.txt), bebas
//   dipakai komersial.
const plusJakartaSans = localFont({
  src: [
    { path: "./fonts/PlusJakartaSans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/PlusJakartaSans-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/PlusJakartaSans-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase jadi dasar untuk semua URL relatif di metadata ini
  // (og:image, canonical, dll) — sumbernya SITE_URL di lib/contact.ts,
  // jadi begitu domain custom final ditentukan, cukup ganti env var
  // NEXT_PUBLIC_SITE_URL, seluruh metadata di bawah otomatis ikut benar.
  metadataBase: new URL(SITE_URL),

  title: {
    // %s diisi otomatis oleh title halaman masing-masing (lihat
    // generateMetadata di halaman layanan/barber), jadi hasilnya misal
    // "Haircut Dewasa | Glori Barbershop" — bagus untuk SEO karena nama
    // brand tetap konsisten muncul di setiap tab/hasil pencarian.
    default: `${BUSINESS_NAME} — Booking Online di Ciporos, Cilacap`,
    template: `%s | ${BUSINESS_NAME}`,
  },
  description: BUSINESS_DESCRIPTION,

  // Kata kunci dasar untuk konteks tambahan (sinyal SEO minor di mata
  // mesin pencari modern, tapi membantu AI assistant memahami topik
  // halaman ini dengan cepat tanpa perlu membaca seluruh isi halaman).
  keywords: [
    "barbershop Cilacap",
    "barber terdekat Ciporos",
    "potong rambut Karangpucung",
    "booking barber online",
    "haircut Cilacap",
    "salon pria Cilacap",
    "Glori Barbershop",
  ],

  authors: [{ name: BUSINESS_NAME }],
  creator: BUSINESS_NAME,
  publisher: BUSINESS_NAME,

  // Bahasa Indonesia sebagai bahasa utama konten (cocok dengan lang="id"
  // di <html> di bawah) — membantu Google menyajikan halaman ini ke
  // pengguna yang mencari dalam Bahasa Indonesia.
  alternates: {
    canonical: "/",
  },

  // Open Graph — dipakai saat link dibagikan ke WhatsApp/Instagram/Facebook,
  // supaya muncul preview kartu yang rapi (gambar + judul + deskripsi),
  // bukan cuma teks link polos.
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: BUSINESS_NAME,
    title: `${BUSINESS_NAME} — Booking Online di Ciporos, Cilacap`,
    description: BUSINESS_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: BUSINESS_NAME,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: `${BUSINESS_NAME} — Booking Online di Ciporos, Cilacap`,
    description: BUSINESS_DESCRIPTION,
    images: ["/og-image.png"],
  },

  // Favicon & ikon lain. File fisiknya ada di /public — lihat juga
  // public/site.webmanifest untuk ikon PWA (Android "Add to Home Screen").
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",

  // Izinkan semua crawler (Googlebot, Bingbot, dan AI crawler seperti
  // GPTBot/ClaudeBot/PerplexityBot — lihat public/robots.txt untuk
  // daftar lengkapnya) mengindeks dan menampilkan snippet penuh.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Verifikasi Google Search Console — owner perlu isi value asli ini
  // setelah daftar domain final di Search Console (Settings > Ownership
  // verification > HTML tag), supaya Google mengakui kepemilikan situs
  // dan mulai menampilkan data performa pencarian.
  // verification: { google: "ISI_DENGAN_KODE_VERIFIKASI_DARI_SEARCH_CONSOLE" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16171b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`h-full antialiased ${plusJakartaSans.variable}`}>
      <body className="min-h-full flex flex-col bg-bg text-text-primary">
        {children}
      </body>
    </html>
  );
}

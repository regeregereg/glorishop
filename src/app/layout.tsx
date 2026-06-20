import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  title: "Glori Barbershop — Booking Online",
  description:
    "Booking potong rambut, treatment, dan colouring di Glori Barbershop tanpa antri.",
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

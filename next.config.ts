import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Foto barber/layanan/produk/portofolio/bukti-transfer disimpan di
    // Supabase Storage dan diakses lewat URL publik *.supabase.co. Pola ini
    // dipakai (bukan hostname spesifik satu project) supaya tetap jalan
    // walau project Supabase berpindah/diganti tanpa perlu edit config lagi.
    // next/image otomatis resize, compress (WebP/AVIF), dan lazy-load semua
    // foto ini di sisi client — jauh lebih ringan dibanding <img> mentah.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    formats: ["image/webp"],
  },
};

export default nextConfig;

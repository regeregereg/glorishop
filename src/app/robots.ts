import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/contact";

// Next.js App Router otomatis menyajikan ini sebagai /robots.txt.
//
// Halaman yang di-block dari indexing: semua area privat (admin, barber
// dashboard, booking, profil, riwayat, login, API routes) — bukan karena
// rahasia, tapi karena halaman ini butuh login/state pengguna spesifik,
// jadi tidak ada gunanya buat Google/AI mengindeksnya (hasil pencarian
// yang mengarah ke halaman "harus login dulu" itu pengalaman buruk buat
// pencari, dan Google bisa menandai sebagai soft-404).
//
// AI crawler (GPTBot, ClaudeBot, PerplexityBot, dll) SENGAJA diizinkan
// secara eksplisit di bawah — beberapa AI crawler tidak otomatis ikut
// aturan User-agent: * dengan baik, jadi lebih aman didaftarkan satu-satu
// supaya niat "boleh dibaca AI" ini tidak ambigu.
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/admin",
    "/barber/dashboard",
    "/barber/riwayat",
    "/barber/login",
    "/booking",
    "/profil",
    "/riwayat",
    "/login",
    "/onboarding",
    "/api",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Crawler AI assistant / LLM — diizinkan eksplisit supaya konten
      // bisnis ini (layanan, barber, lokasi) bisa dipakai untuk menjawab
      // pertanyaan pengguna AI seperti "rekomendasi barber di Cilacap".
      { userAgent: "GPTBot", allow: "/", disallow },
      { userAgent: "ChatGPT-User", allow: "/", disallow },
      { userAgent: "ClaudeBot", allow: "/", disallow },
      { userAgent: "Claude-Web", allow: "/", disallow },
      { userAgent: "PerplexityBot", allow: "/", disallow },
      { userAgent: "Google-Extended", allow: "/", disallow },
      { userAgent: "Bingbot", allow: "/", disallow },
      { userAgent: "Applebot", allow: "/", disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

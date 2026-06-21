import { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/contact";

// Next.js App Router otomatis menyajikan ini sebagai /sitemap.xml.
// Halaman privat (booking, profil, riwayat, semua halaman admin/barber)
// SENGAJA tidak disertakan — sitemap hanya untuk halaman publik yang
// memang ingin diindeks Google, supaya crawler tidak buang waktu (dan
// supaya Google tidak salah paham halaman butuh login itu "broken").
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const [{ data: services }, { data: barbers }] = await Promise.all([
    supabase.from("services").select("id, created_at").eq("is_active", true),
    supabase.from("staff").select("id").eq("role", "barber").eq("is_active", true),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/layanan`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/barber`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/produk`, changeFrequency: "weekly", priority: 0.6 },
  ];

  const servicePages: MetadataRoute.Sitemap = (services ?? []).map((s) => ({
    url: `${SITE_URL}/layanan/${s.id}`,
    lastModified: s.created_at ? new Date(s.created_at) : undefined,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const barberPages: MetadataRoute.Sitemap = (barbers ?? []).map((b) => ({
    url: `${SITE_URL}/barber/${b.id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...servicePages, ...barberPages];
}

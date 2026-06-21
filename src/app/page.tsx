import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { HomeView, type BarberCard } from "@/components/HomeView";
import { BusinessStructuredData } from "@/components/BusinessStructuredData";
import { Service, Staff } from "@/types";
import { unstable_cache } from "next/cache";

// PENTING: halaman ini membaca cookie sesi (getUserSession) dan menampilkan
// nama pengguna + status booking aktif yang BERBEDA per orang — karena itu
// halaman secara keseluruhan TIDAK boleh di-cache penuh (export const
// revalidate di level halaman), supaya tidak ada risiko HTML hasil cache
// milik satu pengguna (mis. sudah login + ada booking aktif) tersaji ke
// pengunjung lain yang sesinya berbeda — ini persis jenis bug yang pernah
// terjadi sebelumnya (lihat PERUBAHAN.md, bug sesi admin/customer tertukar).
//
// Yang dicache di sini HANYA query Supabase untuk data layanan/barber/rating
// (lewat unstable_cache di bawah) — data ini sama untuk semua orang dan
// jarang berubah, jadi aman dibagi/cache selama 60 detik. Bagian session
// tetap selalu dibaca langsung dari cookie tiap request, tidak ikut cache.
export const dynamic = "force-dynamic";

const getCachedHomeData = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const [{ data: services }, { data: barbers }, { data: ratings }, { data: banners }] =
      await Promise.all([
        supabase
          .from("services")
          .select("*")
          .eq("is_active", true)
          .order("sort_order")
          .limit(8),
        supabase
          .from("staff")
          .select("id, name, photo_url, bio")
          .eq("role", "barber")
          .eq("is_active", true)
          .limit(6),
        // Agregasi rata-rata & jumlah review per barber dilakukan LANGSUNG
        // di database lewat RPC (lihat migration_barber_ratings_rpc.sql),
        // bukan ambil semua baris reviews mentah lalu dihitung manual di
        // sini — supaya tidak makin lambat seiring jumlah review bertambah.
        supabase.rpc("get_barber_ratings"),
        supabase
          .from("banners")
          .select("id, image_url")
          .eq("is_active", true)
          .order("sort_order"),
      ]);

    const ratingMap = new Map<string, { avg: number; count: number }>();
    for (const r of ratings ?? []) {
      ratingMap.set(r.barber_id, { avg: r.avg_rating, count: r.review_count });
    }

    const barberCards: BarberCard[] = ((barbers ?? []) as Staff[]).map((b) => {
      const stat = ratingMap.get(b.id);
      return {
        ...b,
        avgRating: stat?.avg ?? null,
        reviewCount: stat?.count ?? 0,
      };
    });

    // Rating keseluruhan TOKO (bukan per-barber) — dipakai di structured
    // data JSON-LD (lihat components/BusinessStructuredData.tsx), dihitung
    // dari agregat yang sama yang sudah diambil di atas, tidak ada query
    // tambahan ke database.
    const allRatings = [...ratingMap.values()];
    const totalReviewCount = allRatings.reduce((sum, r) => sum + r.count, 0);
    const storeAvgRating =
      totalReviewCount > 0
        ? allRatings.reduce((sum, r) => sum + r.avg * r.count, 0) / totalReviewCount
        : null;

    const allServices = (services ?? []) as Service[];
    const prices = allServices
      .map((s) => s.price_min ?? s.price)
      .filter((p): p is number => p != null);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;

    return {
      services: allServices,
      barbers: barberCards,
      minPrice,
      banners: (banners ?? []) as { id: string; image_url: string }[],
      storeAvgRating,
      totalReviewCount,
    };
  },
  ["home-page-data"],
  { revalidate: 60, tags: ["home-data", "services", "barbers", "banners"] }
);

async function getData() {
  return getCachedHomeData();
}

export default async function HomePage() {
  const [session, { services, barbers, minPrice, banners, storeAvgRating, totalReviewCount }] =
    await Promise.all([getUserSession(), getData()]);

  return (
    <>
      <BusinessStructuredData avgRating={storeAvgRating} reviewCount={totalReviewCount} />
      <HomeView
        sessionName={session?.name ?? null}
        avatarUrl={null}
        services={services}
        barbers={barbers}
        minPrice={minPrice}
        hasActiveBooking={!!session}
        banners={banners}
      />
      <BottomNav />
    </>
  );
}

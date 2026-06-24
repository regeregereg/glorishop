import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/BottomNav";
import { HomeView, type BarberCard } from "@/components/HomeView";
import { BusinessStructuredData } from "@/components/BusinessStructuredData";
import { Service, Staff } from "@/types";
import { unstable_cache } from "next/cache";

// Halaman ini sekarang BISA di-cache & diindeks Google karena data sesi
// (nama user, status booking aktif) dipindahkan ke client-side lewat
// /api/me — sehingga HTML yang dikirim server selalu sama untuk semua
// pengunjung, aman di-cache 60 detik, dan Googlebot bisa membacanya.
//
// Data sesi (personal, per-user) tetap aman karena diambil client-side
// setelah halaman dimuat — tidak ada risiko HTML cache satu user
// tersaji ke user lain.
export const revalidate = 60;

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

export default async function HomePage() {
  const { services, barbers, minPrice, banners, storeAvgRating, totalReviewCount } =
    await getCachedHomeData();

  return (
    <>
      <BusinessStructuredData avgRating={storeAvgRating} reviewCount={totalReviewCount} />
      {/* sessionName & hasActiveBooking diambil client-side di HomeView
          lewat /api/me supaya halaman ini tetap statis & bisa diindeks Google */}
      <HomeView
        sessionName={null}
        avatarUrl={null}
        services={services}
        barbers={barbers}
        minPrice={minPrice}
        hasActiveBooking={false}
        banners={banners}
      />
      <BottomNav />
    </>
  );
}

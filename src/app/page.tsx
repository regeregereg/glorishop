import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { HomeView, type BarberCard } from "@/components/HomeView";
import { Service, Staff } from "@/types";

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = createAdminClient();
  const [{ data: services }, { data: barbers }, { data: reviews }] =
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
      supabase.from("reviews").select("barber_id, rating"),
    ]);

  const ratingMap = new Map<string, { total: number; count: number }>();
  for (const r of reviews ?? []) {
    if (!r.barber_id) continue;
    const entry = ratingMap.get(r.barber_id) ?? { total: 0, count: 0 };
    entry.total += r.rating;
    entry.count += 1;
    ratingMap.set(r.barber_id, entry);
  }

  const barberCards: BarberCard[] = ((barbers ?? []) as Staff[]).map((b) => {
    const stat = ratingMap.get(b.id);
    return {
      ...b,
      avgRating: stat ? stat.total / stat.count : null,
      reviewCount: stat?.count ?? 0,
    };
  });

  const allServices = (services ?? []) as Service[];
  const prices = allServices
    .map((s) => s.price_min ?? s.price)
    .filter((p): p is number => p != null);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  return { services: allServices, barbers: barberCards, minPrice };
}

export default async function HomePage() {
  const [session, { services, barbers, minPrice }] = await Promise.all([
    getUserSession(),
    getData(),
  ]);

  return (
    <>
      <HomeView
        sessionName={session?.name ?? null}
        avatarUrl={null}
        services={services}
        barbers={barbers}
        minPrice={minPrice}
        hasActiveBooking={!!session}
      />
      <BottomNav />
    </>
  );
}

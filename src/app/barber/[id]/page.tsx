import { createAdminClient } from "@/lib/supabase/admin";
import { initials } from "@/lib/utils";
import { LinkButton } from "@/components/Button";
import { PortfolioGallery } from "@/components/PortfolioGallery";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { BarberPortfolio } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Star, Scissors } from "lucide-react";
import { notFound } from "next/navigation";

// Halaman ini TIDAK membaca data per-user, isinya sama untuk semua
// pengunjung — aman dicache 60 detik dengan invalidation otomatis saat
// admin mengubah profil/portofolio barber ini (lihat revalidatePath di
// endpoint admin terkait).
export const revalidate = 60;

interface BarberProfile {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  is_active: boolean;
}

async function getBarberProfile(id: string) {
  const supabase = createAdminClient();

  const [{ data: barber }, { data: reviews }, { data: portfolio }] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, name, photo_url, bio, is_active")
        .eq("id", id)
        .eq("role", "barber")
        .single(),
      supabase.from("reviews").select("rating").eq("barber_id", id),
      supabase
        .from("barber_portfolios")
        .select("id, barber_id, photo_url, sort_order, created_at")
        .eq("barber_id", id)
        .order("sort_order", { ascending: true }),
    ]);

  if (!barber) return null;

  const reviewCount = reviews?.length ?? 0;
  const avgRating =
    reviewCount > 0
      ? reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : null;

  return {
    barber: barber as BarberProfile,
    avgRating,
    reviewCount,
    portfolio: (portfolio ?? []) as BarberPortfolio[],
  };
}

export default async function BarberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getBarberProfile(id);
  if (!data || !data.barber.is_active) notFound();

  const { barber, avgRating, reviewCount, portfolio } = data;
  const firstName = barber.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* Hero: foto profil full-bleed */}
      <div className="relative h-[58vh] min-h-[340px] w-full overflow-hidden">
        {barber.photo_url ? (
          <Image
            src={barber.photo_url}
            alt={barber.name}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : (
          <PhotoPlaceholder
            icon={
              <span className="font-display text-7xl font-extrabold">
                {initials(barber.name)}
              </span>
            }
            className="absolute inset-0"
          />
        )}

        {/* Gradient overlay supaya teks & tombol terbaca di atas foto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

        {/* Tombol back — mengambang di atas foto */}
        <div className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))]">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-90"
          >
            <ChevronLeft size={19} />
          </Link>
        </div>

        {/* Liquid glass card — identitas barber menumpuk di atas foto */}
        <div className="absolute inset-x-4 bottom-4">
          <div className="rounded-[var(--radius-card)] border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <h2 className="font-display text-2xl font-extrabold text-white drop-shadow-sm">
              {barber.name}
            </h2>
            <div className="mt-1.5 flex items-center gap-1.5 text-sm">
              <Star size={14} className="fill-accent text-accent" />
              <span className="font-semibold text-white">
                {avgRating ? avgRating.toFixed(1) : "Belum ada rating"}
              </span>
              {reviewCount > 0 && (
                <span className="text-white/60">({reviewCount} ulasan)</span>
              )}
            </div>
            {barber.bio && (
              <p className="mt-2.5 text-sm leading-relaxed text-white/80">
                {barber.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Galeri portofolio */}
      <section className="mt-7 px-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold">
            Hasil Karya {firstName}
          </h3>
          {portfolio.length > 0 && (
            <span className="text-xs text-text-tertiary">
              {portfolio.length} foto
            </span>
          )}
        </div>

        <PortfolioGallery portfolio={portfolio} barberName={barber.name} />
      </section>

      {/* CTA booking */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
        <LinkButton
          href={`/booking?barberId=${barber.id}`}
          variant="order"
          size="lg"
          fullWidth
          icon={<Scissors size={16} />}
        >
          Booking dengan {firstName}
        </LinkButton>
      </div>
    </div>
  );
}

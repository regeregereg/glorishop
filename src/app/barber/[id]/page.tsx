import { createAdminClient } from "@/lib/supabase/admin";
import { initials } from "@/lib/utils";
import { LinkButton } from "@/components/Button";
import { BarberPortfolio } from "@/types";
import Link from "next/link";
import { ChevronLeft, Star, Scissors, ImageOff } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="flex items-center gap-3 px-5 py-4">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-display text-lg font-bold">Profil Barber</h1>
      </header>

      {/* Identitas barber */}
      <div className="px-5">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-soft bg-accent-soft font-display text-xl font-bold text-accent">
            {barber.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={barber.photo_url}
                alt={barber.name}
                className="h-full w-full object-cover"
              />
            ) : (
              initials(barber.name)
            )}
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold text-text-primary">
              {barber.name}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm">
              <Star size={14} className="fill-accent text-accent" />
              <span className="font-semibold text-text-primary">
                {avgRating ? avgRating.toFixed(1) : "Belum ada rating"}
              </span>
              {reviewCount > 0 && (
                <span className="text-text-tertiary">
                  ({reviewCount} ulasan)
                </span>
              )}
            </div>
          </div>
        </div>

        {barber.bio && (
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            {barber.bio}
          </p>
        )}
      </div>

      {/* Galeri portofolio */}
      <section className="mt-7 px-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold">
            Hasil Karya {barber.name.split(" ")[0]}
          </h3>
          {portfolio.length > 0 && (
            <span className="text-xs text-text-tertiary">
              {portfolio.length} foto
            </span>
          )}
        </div>

        {portfolio.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {portfolio.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.photo_url}
                alt={`Hasil karya ${barber.name}`}
                loading="lazy"
                className="aspect-square w-full rounded-2xl border border-border-soft object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-soft bg-surface px-4 py-10 text-center">
            <ImageOff size={28} className="text-text-tertiary" strokeWidth={1.3} />
            <p className="text-sm text-text-secondary">
              Belum ada foto portofolio dari {barber.name.split(" ")[0]}.
            </p>
          </div>
        )}
      </section>

      {/* CTA booking */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
        <LinkButton
          href={`/booking?barberId=${barber.id}`}
          size="lg"
          fullWidth
          icon={<Scissors size={16} />}
        >
          Booking dengan {barber.name.split(" ")[0]}
        </LinkButton>
      </div>
    </div>
  );
}

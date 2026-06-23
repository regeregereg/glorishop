import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/BottomNav";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { Staff } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Star, Scissors, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/contact";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Barber Kami",
  description: "Kenalan sama barber-barber profesional di Glori Barbershop. Pilih yang paling pas buat gaya rambutmu.",
};

interface BarberWithRating extends Staff {
  avgRating: number | null;
  reviewCount: number;
}

async function getBarbers(): Promise<BarberWithRating[]> {
  const supabase = createAdminClient();

  const [{ data: barbers }, { data: ratings }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, photo_url, bio, is_active, created_at")
      .eq("role", "barber")
      .eq("is_active", true)
      .order("name"),
    supabase.rpc("get_barber_ratings"),
  ]);

  const ratingMap = new Map<string, { avg: number; count: number }>();
  for (const r of ratings ?? []) {
    ratingMap.set(r.barber_id, { avg: r.avg_rating, count: r.review_count });
  }

  return ((barbers ?? []) as Staff[]).map((b) => {
    const stat = ratingMap.get(b.id);
    return {
      ...b,
      avgRating: stat?.avg ?? null,
      reviewCount: stat?.count ?? 0,
    };
  });
}

export default async function BarbersPage() {
  const barbers = await getBarbers();

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header — konsisten dengan /layanan */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg/90 px-5 py-4 backdrop-blur-lg">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-display text-lg font-bold">Barber Kami</h1>
      </header>

      <div className="px-5 pt-5">
        {barbers.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-secondary">
            Belum ada barber tersedia.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {barbers.map((b) => {
              const firstName = b.name.split(" ")[0];
              return (
                <Link
                  key={b.id}
                  href={`/barber/${b.id}`}
                  className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-4 transition-colors active:bg-surface-2"
                >
                  {/* Foto */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border-soft bg-surface-2">
                    {b.photo_url ? (
                      <Image
                        src={b.photo_url}
                        alt={b.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <PhotoPlaceholder
                        icon={<Scissors size={24} strokeWidth={1.5} />}
                        className="absolute inset-0"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold text-text-primary truncate">
                      {b.name}
                    </p>

                    {/* Rating */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <Star
                        size={12}
                        className={
                          b.avgRating
                            ? "fill-accent text-accent"
                            : "text-text-tertiary"
                        }
                      />
                      <span className="text-xs font-semibold text-text-secondary">
                        {b.avgRating ? b.avgRating.toFixed(1) : "Baru"}
                      </span>
                      {b.reviewCount > 0 && (
                        <span className="text-xs text-text-tertiary">
                          · {b.reviewCount} ulasan
                        </span>
                      )}
                    </div>

                    {/* Bio */}
                    {b.bio && (
                      <p className="mt-1 truncate text-xs text-text-tertiary">
                        {b.bio}
                      </p>
                    )}
                  </div>

                  {/* CTA chip */}
                  <span className="shrink-0 rounded-full border border-border-soft bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-secondary group-active:bg-bg">
                    Pilih
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Tanya dulu via WA */}
        {barbers.length > 0 && (
          <a
            href={buildWhatsAppUrl("Halo, saya mau tanya-tanya dulu sebelum booking.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-1.5 text-xs font-semibold text-text-secondary"
          >
            <MessageCircle size={13} />
            Bingung pilih siapa? Tanya via WhatsApp
          </a>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import { formatServicePrice } from "@/lib/utils";
import { LinkButton } from "@/components/Button";
import { Service } from "@/types";
import Link from "next/link";
import { ChevronLeft, Clock, Scissors, Sparkles, Palette } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const CATEGORY_ICON = { haircut: Scissors, treatment: Sparkles, colouring: Palette, product: Scissors };
const CATEGORY_LABEL = { haircut: "Haircut", treatment: "Paket Treatment", colouring: "Colouring", product: "Produk" };

async function getService(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("services").select("*").eq("id", id).single();
  return data as Service | null;
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getService(id);
  if (!service) notFound();

  const Icon = CATEGORY_ICON[service.category];
  const hasRange = service.price_min != null && service.price_max != null;

  return (
    <div className="min-h-screen bg-bg pb-10">
      <header className="flex items-center gap-3 px-5 py-4">
        <Link
          href="/layanan"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-display text-lg font-bold">Detail Layanan</h1>
      </header>

      <div className="px-5">
        <div className="flex h-40 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-surface-2 to-surface border border-border-soft text-accent">
          {service.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={service.photo_url} alt={service.name} className="h-full w-full object-cover" />
          ) : (
            <Icon size={56} strokeWidth={1.3} />
          )}
        </div>

        <div className="mt-5">
          <span className="text-xs font-medium uppercase tracking-wide text-accent">
            {CATEGORY_LABEL[service.category]}
          </span>
          <h2 className="font-display mt-1 text-2xl font-extrabold">{service.name}</h2>
          {service.description && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {service.description}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <div className="flex-1 rounded-2xl border border-border-soft bg-surface p-4">
              <p className="text-xs text-text-secondary">Harga</p>
              <p className="font-display mt-1 text-base font-bold text-accent">
                {formatServicePrice(service)}
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-border-soft bg-surface p-4">
              <p className="text-xs text-text-secondary flex items-center gap-1">
                <Clock size={12} /> Estimasi Durasi
              </p>
              <p className="font-display mt-1 text-base font-bold">
                {service.duration_minutes} menit
              </p>
            </div>
          </div>

          {hasRange && (
            <p className="mt-3 text-xs text-text-tertiary">
              Harga final tergantung panjang rambut, dikonfirmasi langsung oleh
              barber di tempat.
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
        <LinkButton href={`/booking?serviceId=${service.id}`} size="lg" fullWidth>
          Booking Layanan Ini
        </LinkButton>
      </div>
    </div>
  );
}

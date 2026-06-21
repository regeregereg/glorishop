import { createAdminClient } from "@/lib/supabase/admin";
import { formatServicePrice } from "@/lib/utils";
import { LinkButton } from "@/components/Button";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { FloatingBackButton } from "@/components/FloatingBackButton";
import { Service } from "@/types";
import Image from "next/image";
import { Clock, Scissors, Sparkles, Palette } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BUSINESS_NAME, SITE_URL } from "@/lib/contact";

// Halaman ini TIDAK membaca data per-user, isinya sama untuk semua
// pengunjung — aman dicache 60 detik dengan invalidation otomatis saat
// admin mengubah layanan ini (lihat revalidatePath di endpoint admin terkait).
export const revalidate = 60;

const CATEGORY_ICON = { haircut: Scissors, treatment: Sparkles, colouring: Palette, product: Scissors };
const CATEGORY_LABEL = { haircut: "Haircut", treatment: "Paket Treatment", colouring: "Colouring", product: "Produk" };

async function getService(id: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("services").select("*").eq("id", id).single();
  return data as Service | null;
}

// Title & description per-layanan — supaya tiap layanan punya snippet
// pencarian sendiri di Google (mis. "Haircut Dewasa | Glori Barbershop"),
// bukan cuma title generik yang sama untuk semua halaman.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const service = await getService(id);
  if (!service) return {};

  const description =
    service.description ||
    `${service.name} di ${BUSINESS_NAME} — ${formatServicePrice(service)}. Booking online tanpa antri.`;

  return {
    title: service.name,
    description,
    alternates: { canonical: `/layanan/${id}` },
    openGraph: {
      title: `${service.name} | ${BUSINESS_NAME}`,
      description,
      images: service.photo_url ? [service.photo_url] : undefined,
      url: `${SITE_URL}/layanan/${id}`,
    },
  };
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

  // Structured data per-layanan — Service + Offer, supaya Google bisa
  // menampilkan info harga langsung di hasil pencarian (rich snippet) saat
  // orang mencari nama layanan ini + nama toko.
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: CATEGORY_LABEL[service.category],
    name: service.name,
    description: service.description || service.name,
    provider: { "@type": "HairSalon", "@id": `${SITE_URL}/#business`, name: BUSINESS_NAME },
    offers: {
      "@type": "Offer",
      priceCurrency: "IDR",
      price: service.price ?? service.price_min ?? undefined,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="min-h-screen bg-bg pb-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {/* Hero: foto layanan full-bleed — pola sama dengan halaman profil
          barber, supaya foto terasa lebih luas/jadi sorotan utama, bukan
          dikecilkan jadi kartu kecil dengan padding di kiri-kanan. */}
      <div className="relative h-[42vh] min-h-[260px] w-full overflow-hidden">
        {service.photo_url ? (
          <Image
            src={service.photo_url}
            alt={service.name}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : (
          <PhotoPlaceholder
            icon={<Icon size={56} strokeWidth={1.3} />}
            className="absolute inset-0"
          />
        )}

        {/* Gradient overlay supaya teks & tombol terbaca di atas foto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40" />

        {/* Tombol back — mengambang di atas foto, kembali ke halaman asal
            sebenarnya (Home atau Semua Layanan) lewat router.back() */}
        <div className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))]">
          <FloatingBackButton fallbackHref="/layanan" />
        </div>

        {/* Liquid glass card — kategori & nama layanan menumpuk di atas foto */}
        <div className="absolute inset-x-4 bottom-4">
          <div className="rounded-[var(--radius-card)] border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              {CATEGORY_LABEL[service.category]}
            </span>
            <h2 className="font-display mt-1 text-2xl font-extrabold text-white drop-shadow-sm">
              {service.name}
            </h2>
          </div>
        </div>
      </div>

      <div className="px-5">
        <div className="mt-5">
          {service.description && (
            <p className="text-sm leading-relaxed text-text-secondary">
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
        <LinkButton href={`/booking?serviceId=${service.id}`} variant="order" size="lg" fullWidth>
          Booking Layanan Ini
        </LinkButton>
      </div>
    </div>
  );
}

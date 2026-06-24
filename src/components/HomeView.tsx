"use client";

import { useMemo, useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  Bell,
  MapPin,
  Star,
  Heart,
  Scissors,
  Sparkles,
  Palette,
  LayoutGrid,
} from "lucide-react";
import { Service, Staff } from "@/types";
import { ServiceCard } from "@/components/ServiceCard";
import { ServiceGridCard } from "@/components/ServiceGridCard";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { LinkButton } from "@/components/Button";
import { BannerCarousel } from "@/components/BannerCarousel";
import { QuickAccess } from "@/components/QuickAccess";
import { LiveQueuePanel } from "@/components/LiveQueuePanel";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { cn, initials, formatRupiah } from "@/lib/utils";
import { MAPS_URL, BUSINESS_FULL_ADDRESS } from "@/lib/contact";

export type BarberCard = Staff & {
  avgRating: number | null;
  reviewCount: number;
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof Scissors }
> = {
  haircut: { label: "Haircuts", icon: Scissors },
  treatment: { label: "Treatment", icon: Sparkles },
  colouring: { label: "Coloring", icon: Palette },
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi!";
  if (hour < 15) return "Selamat siang!";
  if (hour < 18) return "Selamat sore!";
  return "Selamat malam!";
}

// Teks yang berganti-ganti di headline Home
const HEADLINES = [
  "barber terbaikmu!",
  "gaya rambutmu!",
  "waktu santaimu!",
];

export function HomeView({
  sessionName: sessionNameProp,
  avatarUrl,
  services,
  barbers,
  minPrice,
  hasActiveBooking: hasActiveBookingProp,
  banners,
}: {
  sessionName: string | null;
  avatarUrl: string | null;
  services: Service[];
  barbers: BarberCard[];
  minPrice: number | null;
  hasActiveBooking: boolean;
  banners: { id: string; image_url: string }[];
}) {
  // Fetch sesi user di client-side supaya halaman Home bisa di-cache
  // & diindeks Google (server tidak perlu baca cookie per-request lagi).
  const [sessionName, setSessionName] = useState<string | null>(sessionNameProp);
  const [hasActiveBooking, setHasActiveBooking] = useState(hasActiveBookingProp);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        if (d.user?.name) setSessionName(d.user.name);
        setHasActiveBooking(!!d.user);
      })
      .catch(() => {/* gagal fetch sesi — tampilan guest tetap */});
  }, []);

  const [query, setQuery] = useState("");
  const [headlineIdx, setHeadlineIdx] = useState(0);
  const [headlineVisible, setHeadlineVisible] = useState(true);

  // Ganti headline setiap 3 detik dengan fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineVisible(false);
      setTimeout(() => {
        setHeadlineIdx((prev) => (prev + 1) % HEADLINES.length);
        setHeadlineVisible(true);
      }, 350); // durasi fade-out sebelum ganti teks
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // useLayoutEffect jalan setelah hydration tapi SEBELUM browser paint,
  // jadi tidak ada frame yang keliatan "all" dulu sebelum loncat ke
  // kategori tersimpan — fix glitch saat refresh.
  const [category, setCategory] = useState<string>("all");
  useLayoutEffect(() => {
    const saved = sessionStorage.getItem("home-category");
    if (saved && saved !== "all") setCategory(saved);
  }, []);

  function handleSetCategory(cat: string) {
    setCategory(cat);
    sessionStorage.setItem("home-category", cat);
  }

  const [liked, setLiked] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const present = new Set(services.map((s) => s.category));
    return Object.entries(CATEGORY_META).filter(([key]) => present.has(key as Service["category"]));
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCategory = category === "all" || s.category === category;
      const matchQuery = s.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [services, category, query]);

  const filteredBarbers = useMemo(() => {
    if (!query.trim()) return barbers;
    return barbers.filter((b) =>
      b.name.toLowerCase().includes(query.trim().toLowerCase())
    );
  }, [barbers, query]);

  // 4 layanan utama buat grid showcase di Home: haircut dewasa, haircut anak,
  // botak licin, shaver. Dicocokkan dari nama layanan yang ada (case-insensitive,
  // partial match), supaya tetap pas walau penamaan di admin sedikit berbeda.
  const featuredServices = useMemo(() => {
    const KEYWORDS = [
      ["dewasa"],
      ["anak"],
      ["botak", "licin"],
      ["shaver", "cukur"],
    ];

    const used = new Set<string>();
    const picked: Service[] = [];

    for (const keywords of KEYWORDS) {
      const match = services.find(
        (s) =>
          !used.has(s.id) &&
          keywords.some((kw) => s.name.toLowerCase().includes(kw))
      );
      if (match) {
        picked.push(match);
        used.add(match.id);
      }
    }

    // Kalau belum genap 4 (misal admin belum pakai penamaan itu), isi sisanya
    // dari layanan kategori haircut lain, lalu layanan apa pun, berdasar sort_order.
    if (picked.length < 4) {
      const rest = services
        .filter((s) => !used.has(s.id))
        .sort((a, b) => a.sort_order - b.sort_order);
      for (const s of rest) {
        if (picked.length >= 4) break;
        picked.push(s);
        used.add(s.id);
      }
    }

    return picked;
  }, [services]);

  function toggleLike(id: string) {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg pb-24">
      {/* Header */}
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <Link href="/profil" className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="44px" className="object-cover" />
              ) : (
                initials(sessionName || "Glori Barbershop")
              )}
            </div>
            <div>
              <p className="text-xs text-text-secondary">
                {sessionName ? `Hai, ${sessionName.split(" ")[0]}` : "Selamat datang"}
              </p>
              <p className="font-display text-sm font-bold leading-tight">
                {greeting()}
              </p>
            </div>
          </Link>
          <Link
            href={hasActiveBooking ? "/booking/status" : "/riwayat"}
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface text-text-secondary"
          >
            <Bell size={18} />
            {hasActiveBooking && (
              <span className="status-dot-pulse absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" />
            )}
          </Link>
        </div>

        <h1 className="font-display mt-5 text-[26px] font-extrabold leading-[1.15] text-text-primary">
          Yuk, cari{" "}
          <span
            className="text-accent inline-block transition-all duration-350 ease-in-out"
            style={{
              opacity: headlineVisible ? 1 : 0,
              transform: headlineVisible ? "translateY(0)" : "translateY(6px)",
            }}
          >
            {HEADLINES[headlineIdx]}
          </span>
        </h1>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-text-secondary"
        >
          <MapPin size={12} /> {BUSINESS_FULL_ADDRESS}
        </a>

        {/* Search */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface border border-border-soft px-4 py-3.5">
          <Search size={18} className="text-text-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari layanan atau barber..."
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        </div>

        {/* Category pills */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => handleSetCategory("all")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-[9px] text-xs font-semibold transition-colors",
              category === "all"
                ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                : "bg-surface-2 text-text-secondary border border-border-soft"
            )}
          >
            <LayoutGrid size={14} /> Semua
          </button>
          {categories.map(([key, meta]) => {
            const Icon = meta.icon;
            const active = category === key;
            return (
              <button
                key={key}
                onClick={() => handleSetCategory(key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-[9px] text-xs font-semibold transition-colors",
                  active
                    ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                    : "bg-surface-2 text-text-secondary border border-border-soft"
                )}
              >
                <Icon size={14} /> {meta.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Quick Access shortcuts */}
      <QuickAccess />

      {/* Booking aktif */}
      {hasActiveBooking && (
        <section className="px-5">
          <Link
            href="/booking/status"
            className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3"
          >
            <div>
              <p className="text-xs text-text-secondary">Booking aktif</p>
              <p className="text-sm font-semibold text-text-primary">
                Lihat status booking kamu
              </p>
            </div>
            <span className="text-accent text-sm font-semibold">Lihat →</span>
          </Link>
        </section>
      )}

      {/* Barber pilihan — hanya tampil saat tidak ada filter kategori/query aktif */}
      {filteredBarbers.length > 0 && !query.trim() && category === "all" && (
        <section className="mt-6 px-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Barber Pilihan</h2>
            <span className="text-xs text-text-tertiary">
              {filteredBarbers.length} tersedia
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-4">
            {filteredBarbers.map((b, i) => {
              const isLiked = liked.has(b.id);
              return (
                <Link
                  href={`/barber/${b.id}`}
                  key={b.id}
                  className="group relative block h-48 overflow-hidden rounded-[var(--radius-card)] border border-border-soft"
                >
                  {b.photo_url ? (
                    <Image
                      src={b.photo_url}
                      alt={b.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 480px"
                      priority={i === 0}
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <PhotoPlaceholder
                      icon={<Scissors size={56} strokeWidth={1} />}
                      className="absolute inset-0"
                    />
                  )}

                  {/* Gradient overlay biar teks terbaca */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />

                  {/* Rating badge */}
                  <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    <Star size={12} className="fill-accent text-accent" />
                    {b.avgRating ? b.avgRating.toFixed(1) : "Baru"}
                  </div>

                  {/* Heart */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleLike(b.id);
                    }}
                    aria-label="Suka"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-text-primary transition-transform active:scale-90"
                  >
                    <Heart
                      size={15}
                      className={isLiked ? "fill-status-cancelled text-status-cancelled" : "text-text-secondary"}
                    />
                  </button>

                  {/* Bottom info */}
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-display text-base font-bold text-white">{b.name}</p>
                      <p className="mt-0.5 text-xs text-white/75">
                        {b.reviewCount > 0
                          ? `${b.reviewCount} ulasan`
                          : b.bio
                          ? b.bio.slice(0, 36)
                          : "Barber profesional"}
                      </p>
                    </div>
                    {minPrice != null && (
                      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black">
                        mulai {formatRupiah(minPrice)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Layanan Utama — grid showcase 2 kolom */}
      {!query.trim() && (category === "all" || category === "haircut") && featuredServices.length > 0 && (
        <section className="mt-6 px-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Layanan Utama</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {featuredServices.map((s) => (
              <ServiceGridCard key={s.id} service={s} />
            ))}
          </div>
        </section>
      )}

      {/* Layanan */}
      <section className="mt-7 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Layanan</h2>
          <Link href="/layanan" className="text-xs font-semibold text-accent">
            Lihat semua
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {filteredServices.length > 0 ? (
            filteredServices.map((s) => <ServiceCard key={s.id} service={s} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-border-soft bg-surface px-4 py-8 text-center">
              <p className="text-sm text-text-secondary">
                Tidak ada layanan yang cocok dengan pencarian kamu.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Banner Promo / Event */}
      {banners.length > 0 && (
        <section className="mt-7 px-5">
          <div className="overflow-hidden rounded-[var(--radius-card)]">
            <BannerCarousel banners={banners} />
          </div>
        </section>
      )}

      {/* Produk */}
      <section className="mt-7 px-5">
        <Link
          href="/produk"
          className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5"
        >
          <div>
            <p className="text-sm font-semibold">Produk Perawatan Rambut</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              Hair tonic, pomade, dan lainnya
            </p>
          </div>
          <span className="text-accent text-sm font-semibold">Lihat →</span>
        </Link>
      </section>

      {/* Kalender Ketersediaan — cek cepat tanggal mana yang masih ada
          slot kosong, gabungan semua barber, tanpa harus masuk ke flow
          booking penuh dulu. Ditaruh tepat di atas Antrian karena
          keduanya menjawab pertanyaan "bisa cukur sekarang/kapan?" */}
      <section id="kalender-ketersediaan" className="mt-7 px-5 scroll-mt-4">
        <h2 className="font-display text-base font-bold">Cek Ketersediaan</h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          Pilih tanggal untuk lihat jam yang masih kosong
        </p>
        <div className="mt-3">
          <AvailabilityCalendar />
        </div>
      </section>

      {/* Live Queue Panel — bisa dilihat semua orang tanpa login */}
      <LiveQueuePanel />

      {/* CTA bawah kalau belum pernah booking */}
      {!hasActiveBooking && (
        <section className="mt-8 px-5">
          <div className="rounded-[var(--radius-card)] border border-border-soft bg-gradient-to-br from-surface-2 to-surface p-5 text-center">
            <p className="font-display text-sm font-bold text-text-primary">
              Siap tampil rapi hari ini?
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Booking sekarang, datang pas waktunya — tanpa antri.
            </p>
            <LinkButton href="/booking" variant="order" size="md" className="mt-4" fullWidth>
              Booking Sekarang
            </LinkButton>
          </div>
        </section>
      )}
    </div>
  );
}

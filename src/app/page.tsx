import { createAdminClient } from "@/lib/supabase/admin";
import { getUserSession } from "@/lib/session";
import { ServiceCard } from "@/components/ServiceCard";
import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { Service, Staff } from "@/types";
import { Star, MapPin, Bell } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = createAdminClient();
  const [{ data: services }, { data: barbers }] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(6),
    supabase
      .from("staff")
      .select("id, name, photo_url, bio")
      .eq("role", "barber")
      .eq("is_active", true)
      .limit(4),
  ]);
  return {
    services: (services ?? []) as Service[],
    barbers: (barbers ?? []) as Staff[],
  };
}

export default async function HomePage() {
  const [session, { services, barbers }] = await Promise.all([
    getUserSession(),
    getData(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-bg pb-24">
      {/* Header */}
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            {session ? (
              <p className="font-display text-xl font-bold">
                Hai, {session.name.split(" ")[0]} 👋
              </p>
            ) : (
              <p className="font-display text-xl font-bold">Glori Barbershop</p>
            )}
            <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
              <MapPin size={12} /> Ciporos
            </p>
          </div>
          <Link
            href="/profil"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface text-text-secondary"
          >
            <Bell size={18} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-surface-2 to-surface p-6 border border-border-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Booking tanpa antri
          </p>
          <h1 className="font-display mt-2 text-2xl font-extrabold leading-snug text-text-primary">
            Potong rambut,{" "}
            <span className="text-accent">jadwalmu sendiri.</span>
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Pilih layanan, barber favorit, dan slot waktu — datang pas waktunya,
            tanpa nunggu lama.
          </p>
          <LinkButton href="/booking" size="md" className="mt-5">
            Booking Sekarang
          </LinkButton>
        </div>
      </section>

      {/* Latest visit / quick rebook (jika sudah login) */}
      {session && (
        <section className="mt-6 px-5">
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

      {/* Layanan */}
      <section className="mt-7 px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Layanan Populer</h2>
          <Link href="/layanan" className="text-xs font-medium text-accent">
            Lihat semua
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </section>

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

      {/* Barber */}
      {barbers.length > 0 && (
        <section className="mt-7 px-5">
          <h2 className="font-display text-base font-bold">Barber Kami</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {barbers.map((b) => (
              <Link
                href={`/booking?barberId=${b.id}`}
                key={b.id}
                className="flex w-32 shrink-0 flex-col items-center rounded-2xl border border-border-soft bg-surface p-4"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft font-display font-bold text-accent">
                  {b.name.slice(0, 2).toUpperCase()}
                </div>
                <p className="mt-2 text-center text-sm font-semibold leading-tight">
                  {b.name}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                  <Star size={12} className="fill-accent text-accent" /> 4.9
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </div>
  );
}

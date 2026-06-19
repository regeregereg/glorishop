import { createAdminClient } from "@/lib/supabase/admin";
import { ServiceCard } from "@/components/ServiceCard";
import { BottomNav } from "@/components/BottomNav";
import { Service, ServiceCategory } from "@/types";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  haircut: "Haircut",
  treatment: "Paket Treatment",
  colouring: "Colouring",
  product: "Produk",
};

async function getServices() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Service[];
}

export default async function LayananPage() {
  const services = await getServices();
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg/90 px-5 py-4 backdrop-blur-lg">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-display text-lg font-bold">Semua Layanan</h1>
      </header>

      <div className="px-5 pt-5">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-7">
            <h2 className="font-display mb-3 text-sm font-bold text-text-secondary uppercase tracking-wide">
              {CATEGORY_LABEL[category as ServiceCategory]}
            </h2>
            <div className="flex flex-col gap-3">
              {items.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          </section>
        ))}
        {services.length === 0 && (
          <p className="py-10 text-center text-sm text-text-secondary">
            Belum ada layanan tersedia.
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

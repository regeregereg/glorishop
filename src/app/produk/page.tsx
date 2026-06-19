import { createAdminClient } from "@/lib/supabase/admin";
import { formatRupiah } from "@/lib/utils";
import { BottomNav } from "@/components/BottomNav";
import { Product } from "@/types";
import Link from "next/link";
import { ChevronLeft, Package } from "lucide-react";

export const dynamic = "force-dynamic";

async function getProducts() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return (data ?? []) as Product[];
}

export default async function ProdukPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg/90 px-5 py-4 backdrop-blur-lg">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-display text-lg font-bold">Produk</h1>
      </header>

      <p className="px-5 pt-4 text-sm text-text-secondary">
        Produk perawatan rambut, bisa dibeli langsung di tempat saat kamu booking.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 px-5">
        {products.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border-soft bg-surface p-4"
          >
            <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl bg-accent-soft text-accent">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <Package size={28} strokeWidth={1.5} />
              )}
            </div>
            <p className="mt-3 text-sm font-semibold leading-tight">{p.name}</p>
            <p className="mt-1 font-display text-sm font-bold text-accent">
              {formatRupiah(p.price)}
            </p>
          </div>
        ))}
        {products.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-text-secondary">
            Belum ada produk tersedia.
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

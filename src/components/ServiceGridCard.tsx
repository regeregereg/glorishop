import Link from "next/link";
import { Plus, Scissors, Sparkles, Palette } from "lucide-react";
import { Service } from "@/types";
import { formatServicePrice } from "@/lib/utils";

const CATEGORY_ICON = {
  haircut: Scissors,
  treatment: Sparkles,
  colouring: Palette,
  product: Scissors,
};

export function ServiceGridCard({ service }: { service: Service }) {
  const Icon = CATEGORY_ICON[service.category];

  return (
    <Link
      href={`/layanan/${service.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-soft bg-surface transition-colors hover:border-accent/40"
    >
      {/* Gambar */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
        {service.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.photo_url}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent-soft">
            <Icon size={32} strokeWidth={1.5} className="text-accent/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[13px] font-bold leading-tight text-text-primary">
            {service.name}
          </h3>
          <p className="mt-1 truncate text-[12px] font-semibold text-accent">
            {formatServicePrice(service)}
          </p>
        </div>

        {/* Tombol tambah */}
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-transform active:scale-90"
          aria-label="Pilih layanan"
        >
          <Plus size={15} strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}

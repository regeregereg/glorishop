import Link from "next/link";
import Image from "next/image";
import { Plus, Scissors, Sparkles, Palette } from "lucide-react";
import { Service } from "@/types";
import { formatServicePrice } from "@/lib/utils";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

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
          <Image
            src={service.photo_url}
            alt={service.name}
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PhotoPlaceholder icon={<Icon size={32} strokeWidth={1.5} />} />
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

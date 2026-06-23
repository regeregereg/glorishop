import Link from "next/link";
import Image from "next/image";
import { Plus, Scissors, Sparkles, Palette, Home } from "lucide-react";
import { Service } from "@/types";
import { formatServicePrice } from "@/lib/utils";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

const CATEGORY_ICON = {
  haircut: Scissors,
  treatment: Sparkles,
  colouring: Palette,
  product: Scissors,
  home_service: Home,
};

export function ServiceGridCard({ service }: { service: Service }) {
  const Icon = CATEGORY_ICON[service.category];

  return (
    <Link
      href={`/layanan/${service.id}`}
      className="group relative flex overflow-hidden rounded-[var(--radius-card)] border border-border-soft transition-colors hover:border-accent/40 active:scale-[0.97]"
      style={{ aspectRatio: "3/4" }}
    >
      {/* Gambar full card */}
      <div className="absolute inset-0 bg-surface-2">
        {service.photo_url ? (
          <Image
            src={service.photo_url}
            alt={service.name}
            fill
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <PhotoPlaceholder icon={<Icon size={32} strokeWidth={1.5} />} />
        )}
      </div>

      {/* Gradient gelap di bawah supaya teks terbaca */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 50%, transparent 100%)",
        }}
      />

      {/* Info overlay — frosted glass */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 px-3 py-2.5"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          background: "rgba(255,255,255,0.08)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="min-w-0">
          <h3 className="truncate font-display text-[13px] font-bold leading-tight text-white">
            {service.name}
          </h3>
          <p className="mt-0.5 truncate text-[12px] font-semibold text-accent">
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

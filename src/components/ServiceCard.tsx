import { Service } from "@/types";
import { formatServicePrice } from "@/lib/utils";
import { Clock, Scissors, Sparkles, Palette } from "lucide-react";
import Link from "next/link";

const CATEGORY_ICON = {
  haircut: Scissors,
  treatment: Sparkles,
  colouring: Palette,
  product: Scissors,
};

export function ServiceCard({ service }: { service: Service }) {
  const Icon = CATEGORY_ICON[service.category];

  return (
    <Link
      href={`/layanan/${service.id}`}
      className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 transition-colors hover:border-accent/40"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent-soft text-accent">
        {service.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon size={24} strokeWidth={1.8} />
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-display text-[15px] font-semibold leading-tight text-text-primary">
          {service.name}
        </h3>
        <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <Clock size={13} /> {service.duration_minutes} menit
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="font-display text-sm font-bold text-accent">
          {formatServicePrice(service)}
        </p>
      </div>
    </Link>
  );
}

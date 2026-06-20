import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Placeholder untuk foto yang belum tersedia (layanan, barber, dll).
 * Mensimulasikan foto yang di-blur habis (seperti referensi) — glow besar
 * yang menutupi seluruh area, tone netral off-white (bukan amber) supaya
 * terasa lebih "luas"/lapang, bukan kotak gelap rata.
 */
export function PhotoPlaceholder({
  icon,
  className,
}: {
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-surface-2",
        className
      )}
    >
      {/* Glow besar yang menutupi seluruh area — mensimulasikan foto blur */}
      <div className="absolute -left-1/4 -top-1/3 h-[90%] w-3/4 rounded-full bg-white/[0.16] blur-[70px]" />
      <div className="absolute -bottom-1/3 -right-1/4 h-[85%] w-3/4 rounded-full bg-canvas-light/[0.20] blur-[70px]" />
      <div className="absolute left-1/4 top-1/4 h-2/3 w-2/3 rounded-full bg-white/[0.10] blur-[70px]" />

      {/* Vignette tipis biar tetap ada kedalaman, bukan flat */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/25" />

      <div className="relative flex h-full w-full items-center justify-center">
        <span className="text-white/40">{icon}</span>
      </div>
    </div>
  );
}

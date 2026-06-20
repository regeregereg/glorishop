import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Placeholder untuk foto yang belum tersedia (layanan, barber, dll).
 * Efek "liquid glass": beberapa blob blur lembut + lapisan backdrop-blur,
 * tone netral off-white (bukan accent) supaya tidak terasa seperti warna kedua.
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
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-surface-2",
        className
      )}
    >
      {/* Liquid blobs — netral, bukan amber */}
      <div className="absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/[0.08] blur-2xl" />
      <div className="absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-canvas-light/[0.10] blur-2xl" />
      <div className="absolute left-1/3 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-white/[0.05] blur-2xl" />

      {/* Lapisan kaca */}
      <div className="absolute inset-0 backdrop-blur-2xl backdrop-saturate-150" />

      {/* Border halus di dalam, biar terasa seperti panel kaca */}
      <div className="absolute inset-0 border border-white/[0.06]" />

      <span className="relative text-white/30">{icon}</span>
    </div>
  );
}

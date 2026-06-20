import { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * UI error konsisten yang dipakai di dua tempat:
 * 1. Sebagai boundary route (error.tsx) — pakai fullScreen
 * 2. Inline di dalam komponen client setelah fetch gagal (catch block) — default
 */
export function ErrorState({
  title = "Gagal memuat data",
  message = "Terjadi kesalahan. Periksa koneksi internet kamu, lalu coba lagi.",
  onRetry,
  fullScreen = false,
  secondaryAction,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 text-center",
        fullScreen ? "min-h-screen" : "min-h-[55vh] py-12",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-cancelled/10">
        <AlertTriangle size={26} strokeWidth={1.8} className="text-status-cancelled" />
      </div>
      <div>
        <p className="text-base font-semibold text-text-primary">{title}</p>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">{message}</p>
      </div>
      {(onRetry || secondaryAction) && (
        <div className="mt-1 flex items-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black transition-all active:scale-[0.97]"
            >
              <RefreshCw size={15} />
              Coba Lagi
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

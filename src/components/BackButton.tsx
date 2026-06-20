"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        // Kalau ada history (misal dari Home), kembali ke halaman asal.
        // Kalau halaman ini dibuka langsung (refresh / share link, tidak ada
        // history), fallback ke halaman daftar layanan.
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      aria-label="Kembali"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
    >
      <ChevronLeft size={18} />
    </button>
  );
}

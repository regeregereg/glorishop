"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Tombol back mengambang transparan-blur, dipakai di atas hero foto
 * (detail layanan, profil barber). Beda dengan BackButton biasa (kotak
 * border solid, dipakai di halaman ber-background polos) — versi ini
 * butuh kontras tinggi di atas foto apa pun, jadi pakai kaca blur putih.
 *
 * Logic kembali SAMA dengan BackButton: pakai router.back() supaya
 * mendarat di halaman asal yang sebenarnya (Home, Semua Layanan, dst),
 * fallback ke fallbackHref hanya kalau halaman ini dibuka langsung tanpa
 * history sama sekali (mis. refresh atau share link).
 */
export function FloatingBackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      aria-label="Kembali"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-90"
    >
      <ChevronLeft size={19} />
    </button>
  );
}

import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-soft bg-surface-2">
        <Compass size={28} strokeWidth={1.6} className="text-text-secondary" />
      </div>
      <div>
        <h1 className="text-base font-semibold text-text-primary">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black transition-all active:scale-[0.97]"
      >
        <Home size={16} />
        Kembali ke Beranda
      </Link>
    </div>
  );
}

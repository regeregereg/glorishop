"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      fullScreen
      title="Ada yang tidak beres"
      message="Terjadi kesalahan saat memuat halaman ini. Coba lagi, atau kembali ke beranda."
      onRetry={reset}
      secondaryAction={
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-border-soft px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-accent/40 active:scale-[0.97]"
        >
          <Home size={16} />
          Beranda
        </Link>
      }
    />
  );
}

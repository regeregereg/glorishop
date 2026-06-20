"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

export default function BarberError({
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
    <div className="px-5 pt-6">
      <ErrorState
        title="Gagal memuat halaman ini"
        message="Terjadi kesalahan saat memuat data. Coba lagi."
        onRetry={reset}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";

export default function AdminError({
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
      title="Gagal memuat halaman ini"
      message="Terjadi kesalahan saat memuat data admin. Coba lagi."
      onRetry={reset}
    />
  );
}

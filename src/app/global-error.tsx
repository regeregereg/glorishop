"use client";

import { useEffect } from "react";

// Catch-all kalau error terjadi DI DALAM root layout.tsx (jarang terjadi, tapi
// kalau terjadi, Next.js butuh boundary ini karena layout.tsx-nya sendiri yang
// rusak). File ini menggantikan <html>/<body> sepenuhnya, jadi sengaja pakai
// inline style (bukan className Tailwind) supaya tetap tampil benar walau
// globals.css gagal di-load karena root layout-nya error.
export default function GlobalError({
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
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#16171b",
          color: "#ffffff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Aplikasi gagal dimuat
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              color: "#9a9ca3",
              maxWidth: 320,
            }}
          >
            Terjadi kesalahan tak terduga. Coba muat ulang halaman ini.
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            background: "#e18f00",
            color: "#000000",
            border: "none",
            borderRadius: 999,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  );
}

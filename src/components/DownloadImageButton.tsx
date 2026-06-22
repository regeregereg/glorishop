"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
 * Tombol download untuk gambar yang di-host di domain lain (Supabase
 * Storage, *.supabase.co) — bukan domain app sendiri. Atribut HTML
 * `download` pada <a> TIDAK berfungsi untuk URL cross-origin (browser
 * akan tetap membuka gambar di tab baru, bukan men-download), jadi di
 * sini gambar di-fetch dulu sebagai blob, baru di-download lewat object
 * URL sementara yang origin-nya sudah sama dengan halaman ini.
 *
 * Dipakai di halaman pembayaran (QRIS) supaya pelanggan yang ingin
 * scan dari HP lain bisa simpan gambarnya ke galeri dulu, tanpa perlu
 * screenshot manual.
 */
export function DownloadImageButton({
  src,
  filename,
  label = "Simpan Gambar",
}: {
  src: string;
  filename: string;
  label?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error("Gagal mengambil gambar.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback kalau fetch gagal (mis. jaringan terputus, atau browser
      // memblokir blob download di kondisi tertentu) — buka gambar di tab
      // baru, supaya pelanggan masih bisa tekan-lama/screenshot manual
      // alih-alih mentok tanpa cara sama sekali untuk menyimpan QR-nya.
      window.open(src, "_blank");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-1.5 rounded-full border border-border-soft px-4 py-2 text-xs font-semibold text-text-secondary active:scale-95 disabled:opacity-60"
    >
      {downloading ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Download size={13} />
      )}
      {downloading ? "Menyimpan..." : label}
    </button>
  );
}

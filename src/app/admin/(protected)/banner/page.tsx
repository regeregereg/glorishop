"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ImageUpload } from "@/components/ImageUpload";
import { ErrorState } from "@/components/ErrorState";
import { ArrowUp, ArrowDown, Trash2, Eye, EyeOff } from "lucide-react";

interface Banner {
  id: string;
  image_url: string;
  image_path: string;
  sort_order: number;
  is_active: boolean;
}

export default function AdminBannerPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/banners?includeInactive=true");
      if (!res.ok) throw new Error("Gagal memuat banner.");
      const data = await res.json();
      setBanners(data.banners || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Dipakai sebagai sort_order untuk banner baru: sisipkan paling akhir.
  function nextSortOrder() {
    if (banners.length === 0) return 0;
    return Math.max(...banners.map((b) => b.sort_order)) + 1;
  }

  async function handleUploaded(url: string | null) {
    if (!url) return;
    // ImageUpload sudah mengunggah file dan mengembalikan public URL-nya,
    // tapi kita juga perlu image_path (untuk hapus dari storage nanti) —
    // path-nya bisa diturunkan dari URL karena selalu /photos/<path>.
    const path = extractStoragePath(url);
    setUploading(true);
    try {
      const res = await fetch("/api/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: url, image_path: path, sort_order: nextSortOrder() }),
      });
      if (!res.ok) {
        alert("Gagal menyimpan banner.");
        return;
      }
      load();
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleActive(banner: Banner) {
    const res = await fetch(`/api/banners/${banner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !banner.is_active }),
    });
    if (!res.ok) {
      alert("Gagal mengubah status banner.");
      return;
    }
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus banner ini? Gambar akan dihapus permanen.")) return;
    const res = await fetch(`/api/banners/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Gagal menghapus banner.");
      return;
    }
    load();
  }

  // Tukar sort_order dengan tetangga di atas/bawah, lalu simpan keduanya.
  async function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const current = banners[index];
    const target = banners[targetIndex];

    await Promise.all([
      fetch(`/api/banners/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: target.sort_order }),
      }),
      fetch(`/api/banners/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: current.sort_order }),
      }),
    ]);
    load();
  }

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-extrabold">Banner Promo</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Banner tampil sebagai carousel di Home, di bawah daftar layanan. Disarankan
          rasio 2:1 (mis. 1080×540px) supaya tidak terpotong/buram.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border-soft bg-surface p-4">
        <p className="text-sm font-semibold">Tambah Banner Baru</p>
        <div className="mt-3">
          <ImageUpload
            value={null}
            onChange={handleUploaded}
            folder="banner"
            label=""
            shape="square"
          />
        </div>
        {uploading && <p className="mt-2 text-xs text-text-secondary">Menyimpan banner...</p>}
      </div>

      {loadError && (
        <ErrorState
          className="mt-6"
          title="Gagal memuat banner"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={load}
        />
      )}

      {loading && !loadError && (
        <p className="mt-8 text-sm text-text-secondary">Memuat...</p>
      )}

      {!loadError && !loading && (
        <div className="mt-6 flex flex-col gap-3">
          {banners.map((b, index) => (
            <div
              key={b.id}
              className={`flex items-center gap-3 rounded-2xl border bg-surface p-4 ${
                b.is_active ? "border-border-soft" : "border-border-soft opacity-50"
              }`}
            >
              <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border border-border-soft bg-surface-2">
                <Image src={b.image_url} alt="" fill sizes="96px" className="object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-text-secondary">
                  Urutan ke-{index + 1}
                  {!b.is_active && " • Nonaktif"}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-text-secondary hover:border-accent/40 disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() => handleMove(index, "down")}
                  disabled={index === banners.length - 1}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-text-secondary hover:border-accent/40 disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  onClick={() => handleToggleActive(b)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-text-secondary hover:border-accent/40"
                >
                  {b.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-status-cancelled hover:border-status-cancelled/40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {banners.length === 0 && (
            <p className="text-sm text-text-secondary">Belum ada banner.</p>
          )}
        </div>
      )}
    </div>
  );
}

// URL publik Supabase Storage selalu berbentuk
// ".../storage/v1/object/public/<bucket>/<path>" — ambil bagian <path>
// setelah nama bucket "photos/" supaya bisa dipakai untuk hapus file nanti.
function extractStoragePath(publicUrl: string): string {
  const marker = "/photos/";
  const idx = publicUrl.indexOf(marker);
  return idx === -1 ? publicUrl : publicUrl.slice(idx + marker.length);
}

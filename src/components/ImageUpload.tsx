"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  /** URL foto yang sudah tersimpan (saat edit) */
  value: string | null;
  /** Dipanggil setiap kali foto berhasil diupload atau dihapus */
  onChange: (url: string | null) => void;
  /** Subfolder di storage: "barber" | "layanan" | "produk" */
  folder: "barber" | "layanan" | "produk";
  /** Label di atas komponen, opsional */
  label?: string;
  /** Bentuk preview: bulat (untuk foto profil barber) atau kotak (layanan/produk) */
  shape?: "circle" | "square";
}

export function ImageUpload({
  value,
  onChange,
  folder,
  label = "Foto",
  shape = "square",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Format harus JPG, PNG, WEBP, atau AVIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal mengunggah foto.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Gagal mengunggah foto. Coba lagi.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    onChange(null);
    setError("");
  }

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-text-secondary">
          {label}
        </label>
      )}

      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden border border-border-soft bg-surface-2",
            shape === "circle" ? "h-20 w-20 rounded-full" : "h-20 w-20 rounded-2xl"
          )}
        >
          {value ? (
            <Image src={value} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <ImagePlus size={22} className="text-text-secondary/50" />
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={20} className="animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text-primary hover:border-accent/40 disabled:opacity-50"
          >
            {uploading ? "Mengunggah..." : value ? "Ganti foto" : "Unggah foto"}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="flex items-center gap-1 px-1 text-xs font-semibold text-status-cancelled disabled:opacity-50"
            >
              <X size={12} /> Hapus foto
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && <p className="mt-1.5 text-xs text-status-cancelled">{error}</p>}
    </div>
  );
}

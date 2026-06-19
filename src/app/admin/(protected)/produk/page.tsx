"use client";

import { useEffect, useState, useCallback } from "react";
import { Product } from "@/types";
import { Button } from "@/components/Button";
import { ImageUpload } from "@/components/ImageUpload";
import { formatRupiah } from "@/lib/utils";
import { Plus, X, Pencil, Trash2, Package } from "lucide-react";

export default function AdminProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/products?includeInactive=true");
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Nonaktifkan produk ini?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Kelola Produk</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Tambah, edit, atau nonaktifkan produk perawatan rambut.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setEditing("new")}>
          Tambah Produk
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border bg-surface p-4 ${
              p.is_active ? "border-border-soft" : "border-border-soft opacity-50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-accent-soft text-accent">
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package size={22} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(p)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-text-secondary hover:border-accent/40"
                >
                  <Pencil size={13} />
                </button>
                {p.is_active && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft text-status-cancelled hover:border-status-cancelled/40"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-3 font-semibold text-sm">{p.name}</p>
            <p className="mt-0.5 font-display text-sm font-bold text-accent">
              {formatRupiah(p.price)}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Stok: {p.stock}
              {!p.is_active && " • Nonaktif"}
            </p>
          </div>
        ))}
        {products.length === 0 && !loading && (
          <p className="text-sm text-text-secondary">Belum ada produk.</p>
        )}
      </div>

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [stock, setStock] = useState(product?.stock?.toString() ?? "0");
  const [photoUrl, setPhotoUrl] = useState<string | null>(product?.photo_url ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || !price) {
      setError("Nama dan harga wajib diisi.");
      return;
    }
    setSubmitting(true);

    const payload = {
      name,
      price: Number(price),
      stock: Number(stock),
      photo_url: photoUrl,
    };

    try {
      const res = product
        ? await fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            {product ? "Edit Produk" : "Tambah Produk"}
          </h2>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <ImageUpload
            value={photoUrl}
            onChange={setPhotoUrl}
            folder="produk"
            label="Foto produk"
          />
          <input
            placeholder="Nama produk"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="Harga (Rp)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            type="number"
            placeholder="Stok"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />

          {error && (
            <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting} className="mt-1">
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </div>
    </div>
  );
}

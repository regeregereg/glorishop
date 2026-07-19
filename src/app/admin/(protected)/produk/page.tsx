"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Product } from "@/types";
import { Button } from "@/components/Button";
import { ImageUpload } from "@/components/ImageUpload";
import { ErrorState } from "@/components/ErrorState";
import { formatRupiah } from "@/lib/utils";
import { Plus, X, Pencil, Trash2, Package, ShoppingCart, Banknote, QrCode, CheckCircle2 } from "lucide-react";

export default function AdminProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  // Modal terpisah untuk MENCATAT PENJUALAN (bukan kelola katalog) — dipakai
  // admin untuk mencatat pelanggan yang beli produk langsung tanpa dilayani
  // barber (kalau lewat barber, sudah bisa lewat tab "Produk" di Catat
  // Cepat masing-masing barber). Mengurangi stok yang sama & tercatat di
  // tabel product_sales yang sama — lihat /api/product-sales.
  const [showSell, setShowSell] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/products?includeInactive=true");
      if (!res.ok) throw new Error("Gagal memuat produk.");
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Nonaktifkan produk ini?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Gagal menonaktifkan produk.");
        return;
      }
      load();
    } catch {
      alert("Gagal menonaktifkan produk. Periksa koneksi internet kamu.");
    }
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
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<ShoppingCart size={16} />}
            onClick={() => setShowSell(true)}
          >
            Catat Penjualan
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setEditing("new")}>
            Tambah Produk
          </Button>
        </div>
      </div>

      {loadError && (
        <ErrorState
          className="mt-6"
          title="Gagal memuat produk"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={load}
        />
      )}

      {loading && !loadError && (
        <p className="mt-8 text-sm text-text-secondary">Memuat...</p>
      )}

      {!loadError && !loading && (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl border bg-surface p-4 ${
              p.is_active ? "border-border-soft" : "border-border-soft opacity-50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-accent-soft text-accent">
                {p.photo_url ? (
                  <Image src={p.photo_url} alt="" fill sizes="56px" className="object-cover" />
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
        {products.length === 0 && (
          <p className="text-sm text-text-secondary">Belum ada produk.</p>
        )}
      </div>
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {showSell && (
        <SellProductForm
          products={products.filter((p) => p.is_active)}
          onClose={() => setShowSell(false)}
          onSold={load}
        />
      )}
    </div>
  );
}

// ─── Form Catat Penjualan Produk ──────────────────────────────────────────────
// Dipakai admin untuk mencatat pelanggan yang beli produk langsung (tanpa
// dilayani barber). Tidak lewat alur booking/slot sama sekali — cuma
// mengurangi stok & tercatat sebagai penjualan produk, lihat
// /api/product-sales. Barber punya jalur yang sama lewat tab "Produk" di
// Catat Cepat masing-masing dashboard mereka.
function SellProductForm({
  products,
  onClose,
  onSold,
}: {
  products: Product[];
  onClose: () => void;
  onSold: () => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function changeQty(id: string, delta: number) {
    setQty((prev) => {
      const product = products.find((p) => p.id === id);
      const max = product?.stock ?? 0;
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta));
      if (next === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  }

  const selectedEntries = Object.entries(qty).filter(([, v]) => v > 0);
  const totalQty = selectedEntries.reduce((a, [, v]) => a + v, 0);
  const totalPrice = selectedEntries.reduce((sum, [id, count]) => {
    const p = products.find((x) => x.id === id);
    return sum + (p ? p.price * count : 0);
  }, 0);

  async function handleSubmit() {
    setError("");
    if (totalQty === 0) { setError("Pilih minimal satu produk."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/product-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedEntries.map(([product_id, quantity]) => ({ product_id, quantity })),
          payment_method: paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mencatat penjualan.");
        return;
      }
      setDone(true);
      onSold();
      setTimeout(onClose, 1200);
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-accent" />
            <h2 className="font-display text-lg font-bold">Catat Penjualan Produk</h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          Untuk pelanggan yang beli produk langsung, tanpa dilayani barber.
        </p>

        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold text-text-secondary">Dibayar dengan</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("cash")}
              disabled={submitting}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                paymentMethod === "cash"
                  ? "bg-accent text-black"
                  : "border border-border-soft bg-surface text-text-secondary hover:bg-surface-2"
              }`}
            >
              <Banknote size={15} /> Cash
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("qris")}
              disabled={submitting}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                paymentMethod === "qris"
                  ? "bg-accent text-black"
                  : "border border-border-soft bg-surface text-text-secondary hover:bg-surface-2"
              }`}
            >
              <QrCode size={15} /> TF/QR
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {products.length === 0 && (
            <p className="py-4 text-center text-xs text-text-tertiary">Belum ada produk aktif.</p>
          )}
          {products.map((p) => {
            const count = qty[p.id] ?? 0;
            const outOfStock = p.stock <= 0;
            return (
              <div
                key={p.id}
                className={`rounded-xl border px-3 py-2.5 transition-colors ${
                  count > 0 ? "border-accent bg-accent/8" : "border-border-soft bg-surface-2"
                } ${outOfStock ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {formatRupiah(p.price)} · Stok {p.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={submitting || count === 0}
                      onClick={() => changeQty(p.id, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft bg-surface text-text-secondary disabled:opacity-30 active:scale-95 transition-transform text-lg font-bold"
                    >−</button>
                    <span className={`w-7 text-center text-sm font-bold tabular-nums ${count > 0 ? "text-accent" : "text-text-tertiary"}`}>
                      {count}
                    </span>
                    <button
                      type="button"
                      disabled={submitting || outOfStock || count >= p.stock}
                      onClick={() => changeQty(p.id, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-black active:scale-95 transition-transform text-lg font-bold disabled:opacity-30"
                    >+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedEntries.length > 0 && (
          <div className="mt-4 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 flex justify-between text-xs font-bold">
            <span>Total ({totalQty} item)</span>
            <span className="text-accent">{formatRupiah(totalPrice)}</span>
          </div>
        )}

        {done && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-status-done/10 px-3 py-2.5 text-sm text-status-done font-semibold">
            <CheckCircle2 size={16} />
            Penjualan berhasil dicatat!
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
            {error}
          </p>
        )}

        <Button
          fullWidth
          disabled={submitting || done || totalQty === 0}
          onClick={handleSubmit}
          className="mt-4"
        >
          {submitting ? "Menyimpan..." : totalQty > 0 ? `Simpan ${totalQty} Item` : "Simpan"}
        </Button>
      </div>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Service, ServiceCategory } from "@/types";
import { Button } from "@/components/Button";
import { ImageUpload } from "@/components/ImageUpload";
import { ErrorState } from "@/components/ErrorState";
import { formatServicePrice } from "@/lib/utils";
import { Plus, X, Pencil, Trash2 } from "lucide-react";

const CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: "haircut", label: "Haircut" },
  { value: "treatment", label: "Paket Treatment" },
  { value: "colouring", label: "Colouring" },
];

export default function AdminLayananPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/services?includeInactive=true");
      if (!res.ok) throw new Error("Gagal memuat layanan.");
      const data = await res.json();
      setServices(data.services || []);
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
    if (!confirm("Nonaktifkan layanan ini?")) return;
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Gagal menonaktifkan layanan.");
        return;
      }
      load();
    } catch {
      alert("Gagal menonaktifkan layanan. Periksa koneksi internet kamu.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Kelola Layanan</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Tambah, edit, atau nonaktifkan layanan.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setEditing("new")}>
          Tambah Layanan
        </Button>
      </div>

      {loadError && (
        <ErrorState
          className="mt-6"
          title="Gagal memuat layanan"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={load}
        />
      )}

      {loading && !loadError && (
        <p className="mt-8 text-sm text-text-secondary">Memuat...</p>
      )}

      {!loadError && !loading && (
      <div className="mt-6 flex flex-col gap-3">
        {services.map((s) => (
          <div
            key={s.id}
            className={`flex items-center justify-between rounded-2xl border bg-surface p-4 ${
              s.is_active ? "border-border-soft" : "border-border-soft opacity-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border-soft bg-surface-2">
                {s.photo_url ? (
                  <Image src={s.photo_url} alt="" fill sizes="48px" className="object-cover" />
                ) : null}
              </div>
              <div>
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {s.category} • {s.duration_minutes} menit • {formatServicePrice(s)}
                  {!s.is_active && " • Nonaktif"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(s)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-text-secondary hover:border-accent/40"
              >
                <Pencil size={15} />
              </button>
              {s.is_active && (
                <button
                  onClick={() => handleDelete(s.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft text-status-cancelled hover:border-status-cancelled/40"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <p className="text-sm text-text-secondary">Belum ada layanan.</p>
        )}
      </div>
      )}

      {editing && (
        <ServiceForm
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function ServiceForm({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState<ServiceCategory>(service?.category ?? "haircut");
  const [photoUrl, setPhotoUrl] = useState<string | null>(service?.photo_url ?? null);
  const [priceMode, setPriceMode] = useState<"fixed" | "range">(
    service?.price_min != null ? "range" : "fixed"
  );
  const [price, setPrice] = useState(service?.price?.toString() ?? "");
  const [priceMin, setPriceMin] = useState(service?.price_min?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(service?.price_max?.toString() ?? "");
  const [duration, setDuration] = useState(service?.duration_minutes?.toString() ?? "30");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name) {
      setError("Nama layanan wajib diisi.");
      return;
    }
    setSubmitting(true);

    const payload = {
      name,
      description,
      category,
      duration_minutes: Number(duration),
      price: priceMode === "fixed" ? Number(price) : null,
      price_min: priceMode === "range" ? Number(priceMin) : null,
      price_max: priceMode === "range" ? Number(priceMax) : null,
      photo_url: photoUrl,
    };

    try {
      const res = service
        ? await fetch(`/api/services/${service.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/services", {
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
            {service ? "Edit Layanan" : "Tambah Layanan"}
          </h2>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <ImageUpload
            value={photoUrl}
            onChange={setPhotoUrl}
            folder="layanan"
            label="Foto layanan"
          />
          <input
            placeholder="Nama layanan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            placeholder="Deskripsi (opsional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ServiceCategory)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Durasi (menit)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPriceMode("fixed")}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                priceMode === "fixed"
                  ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                  : "border border-border-soft text-text-secondary"
              }`}
            >
              Harga Tetap
            </button>
            <button
              type="button"
              onClick={() => setPriceMode("range")}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                priceMode === "range"
                  ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
                  : "border border-border-soft text-text-secondary"
              }`}
            >
              Range Harga
            </button>
          </div>

          {priceMode === "fixed" ? (
            <input
              type="number"
              placeholder="Harga (Rp)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Harga min"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-1/2 rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
              <input
                type="number"
                placeholder="Harga max"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-1/2 rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
          )}

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

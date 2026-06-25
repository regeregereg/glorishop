"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Service, ServiceCategory, Staff } from "@/types";
import { Button } from "@/components/Button";
import { ImageUpload } from "@/components/ImageUpload";
import { ErrorState } from "@/components/ErrorState";
import { formatServicePrice } from "@/lib/utils";
import { Plus, X, Pencil, Trash2, Check, Percent, Home, Users } from "lucide-react";

const CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: "haircut", label: "Haircut" },
  { value: "treatment", label: "Paket Treatment" },
  { value: "colouring", label: "Colouring" },
  { value: "home_service", label: "Home Service (ke rumah)" },
];

export default function AdminLayananPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [resServices, resBarbers] = await Promise.all([
        fetch("/api/services?includeInactive=true"),
        fetch("/api/barbers?includeInactive=true"),
      ]);
      if (!resServices.ok) throw new Error("Gagal memuat layanan.");
      const data = await resServices.json();
      setServices(data.services || []);
      if (resBarbers.ok) {
        const barberData = await resBarbers.json();
        setBarbers(barberData.barbers || []);
      }
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
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.commission_percentage != null && s.commission_percentage > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <Percent size={9} /> Komisi {s.commission_percentage}%
                    </span>
                  )}
                  {s.is_home_service_only && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                      <Home size={9} /> Booking only
                    </span>
                  )}
                  {s.barber_prices != null && s.barber_prices.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                      <Users size={9} /> {s.barber_prices.length} harga custom
                    </span>
                  )}
                </div>
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
          barbers={barbers}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function ServiceForm({
  service,
  barbers,
  onClose,
  onSaved,
}: {
  service: Service | null;
  barbers: Staff[];
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
  const [commissionPercentage, setCommissionPercentage] = useState(
    service?.commission_percentage?.toString() ?? ""
  );
  const [isHomeServiceOnly, setIsHomeServiceOnly] = useState(service?.is_home_service_only ?? false);
  const [barberIds, setBarberIds] = useState<string[]>(service?.barber_ids ?? []);

  // Harga khusus per barber (override) — defaultnya semua barber pakai
  // harga dasar layanan ini (lihat src/lib/pricing.ts). Disimpan sebagai
  // map barber_id -> nilai input (string, supaya field bisa kosong tanpa
  // jadi 0), satu set untuk price (mode tetap) dan satu set untuk
  // price_min/price_max (mode range), supaya kalau admin ganti priceMode
  // input yang sudah diisi sebelumnya tidak hilang sia-sia.
  const initialOverrides = service?.barber_prices ?? [];
  const [barberPriceOverride, setBarberPriceOverride] = useState<Record<string, string>>(
    Object.fromEntries(
      initialOverrides.filter((p) => p.price != null).map((p) => [p.barber_id, String(p.price)])
    )
  );
  const [barberPriceMinOverride, setBarberPriceMinOverride] = useState<Record<string, string>>(
    Object.fromEntries(
      initialOverrides.filter((p) => p.price_min != null).map((p) => [p.barber_id, String(p.price_min)])
    )
  );
  const [barberPriceMaxOverride, setBarberPriceMaxOverride] = useState<Record<string, string>>(
    Object.fromEntries(
      initialOverrides.filter((p) => p.price_max != null).map((p) => [p.barber_id, String(p.price_max)])
    )
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleBarber(id: string) {
    setBarberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name) {
      setError("Nama layanan wajib diisi.");
      return;
    }
    if (isHomeServiceOnly && barberIds.length === 0) {
      setError("Pilih minimal satu barber yang menerima layanan home service ini.");
      return;
    }

    // Bangun payload barber_prices sesuai priceMode aktif. Untuk mode range,
    // kedua kolom (min & max) harus diisi sekaligus per barber — kalau
    // cuma salah satu yang diisi, tolak di sini supaya admin tidak kaget
    // override-nya diam-diam diabaikan server (lihat src/lib/pricing.ts:
    // override range yang tidak lengkap dianggap tidak valid).
    const barberPrices: { barber_id: string; price: number | null; price_min: number | null; price_max: number | null }[] = [];
    if (priceMode === "fixed") {
      for (const [barberId, val] of Object.entries(barberPriceOverride)) {
        if (val === "") continue;
        barberPrices.push({ barber_id: barberId, price: Number(val), price_min: null, price_max: null });
      }
    } else {
      const barberIdsTouched = new Set([
        ...Object.keys(barberPriceMinOverride).filter((id) => barberPriceMinOverride[id] !== ""),
        ...Object.keys(barberPriceMaxOverride).filter((id) => barberPriceMaxOverride[id] !== ""),
      ]);
      for (const barberId of barberIdsTouched) {
        const minVal = barberPriceMinOverride[barberId];
        const maxVal = barberPriceMaxOverride[barberId];
        if (!minVal || !maxVal) {
          const barberName = barbers.find((b) => b.id === barberId)?.name ?? "barber ini";
          setError(`Isi harga min DAN max untuk ${barberName}, atau kosongkan keduanya untuk pakai harga dasar.`);
          return;
        }
        barberPrices.push({ barber_id: barberId, price: null, price_min: Number(minVal), price_max: Number(maxVal) });
      }
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
      commission_percentage: commissionPercentage ? Number(commissionPercentage) : null,
      is_home_service_only: isHomeServiceOnly,
      barber_ids: isHomeServiceOnly ? barberIds : [],
      barber_prices: barberPrices,
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
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

          {/* Harga khusus per barber (override) — defaultnya semua barber
              pakai harga dasar di atas. Admin isi satu-satu di sini hanya
              untuk barber yang memang perlu beda tarif; kosongkan untuk
              kembali ke harga dasar. Bentuk input ikut priceMode yang
              sedang aktif (tetap atau range), sama seperti harga dasarnya. */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">
              Harga khusus per barber (opsional)
            </p>
            <p className="mb-2 text-[11px] text-text-tertiary">
              Kosongkan untuk barber yang pakai harga dasar di atas. Isi hanya untuk barber yang tarifnya beda.
            </p>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-xl border border-border-soft bg-surface-2 p-2.5">
              {barbers.map((b) => (
                <div key={b.id} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs text-text-secondary">{b.name}</span>
                  {priceMode === "fixed" ? (
                    <input
                      type="number"
                      placeholder={price ? `Default: ${price}` : "Harga (Rp)"}
                      value={barberPriceOverride[b.id] ?? ""}
                      onChange={(e) =>
                        setBarberPriceOverride((prev) => ({ ...prev, [b.id]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  ) : (
                    <div className="flex flex-1 gap-1.5">
                      <input
                        type="number"
                        placeholder={priceMin ? `Min: ${priceMin}` : "Min"}
                        value={barberPriceMinOverride[b.id] ?? ""}
                        onChange={(e) =>
                          setBarberPriceMinOverride((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                        className="w-1/2 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                      <input
                        type="number"
                        placeholder={priceMax ? `Max: ${priceMax}` : "Max"}
                        value={barberPriceMaxOverride[b.id] ?? ""}
                        onChange={(e) =>
                          setBarberPriceMaxOverride((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                        className="w-1/2 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  )}
                </div>
              ))}
              {barbers.length === 0 && (
                <p className="px-1 py-1 text-xs text-text-tertiary">Belum ada barber.</p>
              )}
            </div>
          </div>

          {/* Komisi/bagi hasil untuk barber dari layanan ini, contoh 40 = 40%.
              Berlaku sama untuk semua barber yang mengerjakan layanan ini. */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">
              Persentase komisi barber (%)
            </p>
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              placeholder="Contoh: 40 untuk 40%"
              value={commissionPercentage}
              onChange={(e) => setCommissionPercentage(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-text-tertiary">
              Kosongkan jika layanan ini tidak punya komisi khusus.
            </p>
          </div>

          {/* Toggle home service: layanan ke rumah, wajib booking, tidak
              bisa dipakai untuk walk-in di tempat (barber maupun admin). */}
          <button
            type="button"
            onClick={() => setIsHomeServiceOnly((v) => !v)}
            className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-colors ${
              isHomeServiceOnly ? "border-accent bg-accent/10" : "border-border-soft bg-surface-2"
            }`}
          >
            <div>
              <p className="text-sm font-semibold">Wajib booking (home service)</p>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                Tidak bisa dipakai untuk walk-in di tempat, hanya bisa lewat booking, dan hanya barber tertentu yang menerima.
              </p>
            </div>
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                isHomeServiceOnly ? "border-accent bg-accent text-black" : "border-border-soft"
              }`}
            >
              {isHomeServiceOnly && <Check size={12} strokeWidth={3} />}
            </div>
          </button>

          {isHomeServiceOnly && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                Barber yang menerima layanan ini
              </p>
              <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border-soft bg-surface-2 p-2">
                {barbers.map((b) => {
                  const checked = barberIds.includes(b.id);
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => toggleBarber(b.id)}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        checked ? "bg-accent/15 text-text-primary" : "text-text-secondary hover:bg-surface"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                          checked ? "border-accent bg-accent text-black" : "border-border-soft"
                        }`}
                      >
                        {checked && <Check size={10} strokeWidth={3} />}
                      </div>
                      {b.name}
                    </button>
                  );
                })}
                {barbers.length === 0 && (
                  <p className="px-2 py-2 text-xs text-text-tertiary">Belum ada barber.</p>
                )}
              </div>
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

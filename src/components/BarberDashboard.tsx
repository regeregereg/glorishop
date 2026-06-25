"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking, Service } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatTime, formatRupiah, getBookingServiceNames, getBookingPriceLabel, toLocalDateString } from "@/lib/utils";
import { getBookingTotalCommission } from "@/lib/commission";
import { getEffectivePrice } from "@/lib/pricing";
import { Play, Check, Star, Plus, X, Scissors, Wallet, AlertCircle } from "lucide-react";

export default function BarberDashboardPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmDoneId, setConfirmDoneId] = useState<string | null>(null);
  const [showWalkinForm, setShowWalkinForm] = useState(false);

  const today = toLocalDateString(new Date());

  function loadSession() {
    setSessionError(false);
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat sesi.");
        return r.json();
      })
      .then((d) => {
        if (d.staff) {
          setStaffId(d.staff.id);
          setStaffName(d.staff.name);
        }
      })
      .catch(() => {
        setLoading(false);
        setSessionError(true);
      });
  }

  useEffect(() => {
    loadSession();
  }, []);

  // isInitialLoad: tampilkan layar error penuh hanya untuk pemuatan
  // pertama antrian. Kalau polling 15 detik berikutnya gagal (koneksi
  // sempat putus), diamkan saja — antrian yang sudah tampil tetap ada,
  // dicoba lagi otomatis di siklus berikutnya.
  const loadQueue = useCallback(
    async (isInitialLoad = false) => {
      if (!staffId) return;
      try {
        const res = await fetch(`/api/bookings?barberId=${staffId}&date=${today}`);
        if (!res.ok) throw new Error("Gagal memuat antrian.");
        const data = await res.json();
        setBookings(data.bookings || []);
        setLoadError(false);
      } catch {
        if (isInitialLoad) setLoadError(true);
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    },
    [staffId, today]
  );

  useEffect(() => {
    loadQueue(true);
    const interval = setInterval(() => loadQueue(), 15000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  async function updateStatus(bookingId: string, status: string) {
    setActingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) loadQueue(true);
      else {
        const data = await res.json();
        alert(data.error || "Gagal update status.");
      }
    } catch {
      alert("Gagal update status. Periksa koneksi internet kamu.");
    } finally {
      setActingId(null);
    }
  }

  const queue = bookings
    .filter((b) => ["WAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "PENDING"].includes(b.status))
    .sort((a, b) => (a.slot?.start_time ?? "").localeCompare(b.slot?.start_time ?? ""));

  // Total komisi hari ini, dihitung dari booking yang sudah CONFIRMED ke
  // atas (walk-in langsung CONFIRMED, booking online butuh verifikasi
  // dulu) — bukan cuma yang DONE, supaya barber bisa lihat estimasi
  // komisinya berjalan sepanjang hari, tidak baru muncul di akhir.
  const todayCommission = bookings
    .filter((b) => ["CONFIRMED", "IN_PROGRESS", "DONE"].includes(b.status))
    .reduce((sum, b) => sum + getBookingTotalCommission(b), 0);

  // Booking IN_PROGRESS yang sudah lebih dari 45 menit — reminder ke barber
  const bookingTerlupakan = queue.filter((b) => {
    if (b.status !== "IN_PROGRESS" || !b.slot?.date || !b.slot?.start_time) return false;
    const slotStart = new Date(`${b.slot.date}T${b.slot.start_time}`);
    return Date.now() - slotStart.getTime() > 45 * 60 * 1000;
  });

  return (
    <div className="px-5 pt-6">
      {bookingTerlupakan.length > 0 && (
        <div className="mb-5 rounded-2xl border border-status-progress/40 bg-status-progress/10 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-status-progress" />
            <p className="text-sm font-bold text-status-progress">
              Jangan lupa tandai selesai!
            </p>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {bookingTerlupakan.map((b) => b.user?.name ?? b.walkin_name ?? "Pelanggan").join(", ")} sudah selesai lebih dari 45 menit. Scroll ke bawah dan klik &ldquo;Selesai&rdquo;.
          </p>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Hai, {staffName.split(" ")[0] || "Barber"} 👋</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Antrian klien kamu hari ini.
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus size={15} />}
          onClick={() => setShowWalkinForm(true)}
          className="shrink-0"
        >
          Cukur Langsung
        </Button>
      </div>

      {!loading && !sessionError && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Wallet size={16} />
          </div>
          <div>
            <p className="text-xs text-text-secondary">Estimasi komisi hari ini</p>
            <p className="font-display text-base font-bold text-accent">{formatRupiah(todayCommission)}</p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {sessionError && (
          <ErrorState
            title="Gagal memuat sesi"
            message="Periksa koneksi internet kamu, lalu coba lagi."
            onRetry={loadSession}
          />
        )}

        {!sessionError && loadError && (
          <ErrorState
            title="Gagal memuat antrian"
            message="Periksa koneksi internet kamu, lalu coba lagi."
            onRetry={() => loadQueue(true)}
          />
        )}

        {loading && !sessionError && !loadError && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {!loading && !sessionError && !loadError && queue.length === 0 && (
          <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-6 py-12 text-center">
            <p className="font-display text-sm font-semibold">Belum ada antrian hari ini</p>
          </div>
        )}

        {queue.map((b) => (
          <div
            key={b.id}
            className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-bold">
                  {b.user?.name ?? b.walkin_name ?? "Pelanggan"}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {getBookingServiceNames(b)} • {b.slot ? formatTime(b.slot.start_time) : ""}
                  {b.walkin_by_barber && " • Walk-in"}
                </p>
              </div>
              <StatusBadge status={b.status} size="sm" />
            </div>

            <p className="mt-3 font-display text-sm font-bold text-accent">
              {getBookingPriceLabel(b)}
            </p>

            <div className="mt-4 flex gap-2">
              {b.status === "WAITING_PAYMENT" && (
                <span className="text-xs text-text-tertiary">
                  Menunggu pembayaran pelanggan
                </span>
              )}
              {b.status === "PENDING" && (
                <span className="text-xs text-text-tertiary">
                  Menunggu konfirmasi admin
                </span>
              )}
              {b.status === "CONFIRMED" && (
                <Button
                  size="lg"
                  fullWidth
                  icon={<Play size={18} />}
                  onClick={() => updateStatus(b.id, "IN_PROGRESS")}
                  disabled={actingId === b.id}
                >
                  Mulai
                </Button>
              )}
              {b.status === "IN_PROGRESS" && (
                confirmDoneId === b.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-center text-xs font-semibold text-text-primary">
                      Tandai pekerjaan ini selesai?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        fullWidth
                        variant="ghost"
                        onClick={() => setConfirmDoneId(null)}
                      >
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        fullWidth
                        icon={<Check size={15} />}
                        onClick={() => { setConfirmDoneId(null); updateStatus(b.id, "DONE"); }}
                        disabled={actingId === b.id}
                      >
                        Ya, Selesai
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    fullWidth
                    variant="secondary"
                    icon={<Check size={18} />}
                    onClick={() => setConfirmDoneId(b.id)}
                    disabled={actingId === b.id}
                  >
                    Selesai
                  </Button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-text-tertiary">
        <Star size={14} className="fill-accent text-accent" />
        Lihat riwayat dan rating kamu di tab Riwayat
      </div>

      {showWalkinForm && staffId && (
        <WalkinForm
          barberId={staffId}
          onClose={() => setShowWalkinForm(false)}
          onCreated={() => loadQueue(true)}
        />
      )}
    </div>
  );
}

// Form untuk barber mencatat pelanggan yang datang LANGSUNG ke tempat
// tanpa booking sebelumnya (bayar di tempat). Tidak perlu pilih
// tanggal/jam/slot sama sekali — sistem otomatis membuat slot "sekarang"
// di belakang layar (lihat POST /api/bookings/walkin). Layanan home
// service tidak ditampilkan di sini sama sekali karena wajib booking di
// muka, tidak bisa dicatat sebagai walk-in.
function WalkinForm({
  barberId,
  onClose,
  onCreated,
}: {
  barberId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [finalPrices, setFinalPrices] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => {
        // Layanan home service tidak boleh dipakai untuk walk-in di
        // tempat — disaring di sini supaya barber tidak salah pilih,
        // server juga menolaknya lagi sebagai jaga-jaga (lihat
        // POST /api/bookings/walkin).
        const eligible = (d.services || []).filter(
          (s: Service) => !s.is_home_service_only && s.category !== "home_service"
        );
        setServices(eligible);
      })
      .finally(() => setServicesLoading(false));
  }, []);

  function toggleService(s: Service) {
    setServiceIds((prev) =>
      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
    );
  }

  const selectedServiceObjs = serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => !!s);
  // Layanan dengan range harga (mis. Colour, Bleaching) butuh harga final
  // diisi manual oleh barber, karena tidak ada harga pasti sampai dicek
  // kondisi rambut pelanggan langsung di tempat.
  const rangeServices = selectedServiceObjs.filter((s) => s.price_min != null && s.price_max != null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (serviceIds.length === 0) {
      setError("Pilih minimal satu layanan.");
      return;
    }
    for (const s of rangeServices) {
      if (!finalPrices[s.id]) {
        setError(`Isi harga final untuk "${s.name}" (layanan dengan range harga).`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barber_id: barberId,
          service_ids: serviceIds,
          walkin_name: name || undefined,
          walkin_phone: phone || undefined,
          final_prices: Object.fromEntries(
            Object.entries(finalPrices).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mencatat cukuran.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Terjadi kesalahan. Periksa koneksi internet kamu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors size={18} className="text-accent" />
            <h2 className="font-display text-lg font-bold">Cukur Langsung</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Untuk pelanggan yang datang langsung tanpa booking. Otomatis tercatat ke admin.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            placeholder="Nama pelanggan (opsional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            placeholder="Nomor telepon (opsional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />

          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">
              Layanan (boleh pilih lebih dari satu)
            </p>
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border-soft bg-surface-2 p-2">
              {servicesLoading && (
                <p className="px-2 py-2 text-xs text-text-tertiary">Memuat layanan...</p>
              )}
              {!servicesLoading && services.map((s) => {
                const checked = serviceIds.includes(s.id);
                const eff = getEffectivePrice(s, barberId);
                const priceLabel =
                  eff.price_min != null && eff.price_max != null
                    ? `${formatRupiah(eff.price_min)}–${formatRupiah(eff.price_max)}`
                    : eff.price != null
                    ? formatRupiah(eff.price)
                    : "";
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleService(s)}
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
                    <span className="flex-1">{s.name}</span>
                    {priceLabel && (
                      <span className="shrink-0 text-xs font-semibold text-text-tertiary">{priceLabel}</span>
                    )}
                  </button>
                );
              })}
              {!servicesLoading && services.length === 0 && (
                <p className="px-2 py-2 text-xs text-text-tertiary">Belum ada layanan tersedia.</p>
              )}
            </div>
          </div>

          {rangeServices.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-text-secondary">
                Harga final (layanan dengan range harga)
              </p>
              {rangeServices.map((s) => {
                const eff = getEffectivePrice(s, barberId);
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-text-secondary">{s.name}</span>
                    <input
                      type="number"
                      placeholder={`${eff.price_min}-${eff.price_max}`}
                      value={finalPrices[s.id] ?? ""}
                      onChange={(e) => setFinalPrices((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="w-32 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting} className="mt-1">
            {submitting ? "Menyimpan..." : "Catat & Selesai"}
          </Button>
        </form>
      </div>
    </div>
  );
}

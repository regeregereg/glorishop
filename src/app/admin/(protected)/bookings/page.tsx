"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking, BookingStatus, STATUS_LABELS, Service, Staff, Slot } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { formatTime, getBookingServiceNames, getBookingPriceLabel, formatDateShort, toLocalDateString } from "@/lib/utils";
import { Plus, X, Check } from "lucide-react";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [showWalkinForm, setShowWalkinForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/bookings");
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    statusFilter === "ALL" ? bookings : bookings.filter((b) => b.status === statusFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Semua Booking</h1>
          <p className="mt-1 text-sm text-text-secondary">Filter berdasarkan status.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowWalkinForm(true)}>
          Booking Walk-in
        </Button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {(["ALL", ...Object.keys(STATUS_LABELS)] as (BookingStatus | "ALL")[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium ${
              statusFilter === s
                ? "bg-accent text-black"
                : "border border-border-soft bg-surface text-text-secondary"
            }`}
          >
            {s === "ALL" ? "Semua" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-border-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-surface text-left text-xs text-text-secondary">
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Layanan</th>
              <th className="px-4 py-3">Barber</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-border-soft last:border-0">
                <td className="px-4 py-3 font-medium">
                  {b.user?.name ?? b.walkin_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary">{getBookingServiceNames(b)}</td>
                <td className="px-4 py-3 text-text-secondary">{b.barber?.name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {b.slot ? `${formatDateShort(b.slot.date)} ${formatTime(b.slot.start_time)}` : "—"}
                </td>
                <td className="px-4 py-3 text-accent font-semibold">
                  {getBookingPriceLabel(b)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} size="sm" />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Tidak ada booking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showWalkinForm && (
        <WalkinForm onClose={() => setShowWalkinForm(false)} onCreated={load} />
      )}
    </div>
  );
}

function WalkinForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [slotId, setSlotId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then((d) => setServices(d.services || []));
    fetch("/api/barbers").then((r) => r.json()).then((d) => setBarbers(d.barbers || []));
  }, []);

  useEffect(() => {
    if (!barberId || !date) return;
    fetch(`/api/slots?barberId=${barberId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => setSlots((d.slots || []).filter((s: Slot) => s.is_available)));
  }, [barberId, date]);

  function toggleService(id: string) {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || serviceIds.length === 0 || !slotId) {
      setError("Lengkapi semua data wajib (minimal 1 layanan).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_ids: serviceIds,
          slot_id: slotId,
          barber_id: barberId,
          created_by_admin: true,
          walkin_name: name,
          walkin_phone: phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat booking.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border-soft bg-surface p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Booking Walk-in</h2>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            placeholder="Nama pelanggan"
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
            <p className="mb-1.5 text-xs font-medium text-text-secondary">
              Layanan (boleh pilih lebih dari satu)
            </p>
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border-soft bg-surface-2 p-2">
              {services.map((s) => {
                const checked = serviceIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleService(s.id)}
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
                    {s.name}
                  </button>
                );
              })}
              {services.length === 0 && (
                <p className="px-2 py-2 text-xs text-text-tertiary">Memuat layanan...</p>
              )}
            </div>
          </div>

          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Pilih barber</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            disabled={!barberId}
          >
            <option value="">Pilih slot waktu</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatTime(s.start_time)}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-tertiary">
            Catatan: untuk booking dengan banyak layanan yang totalnya lebih lama dari
            satu slot, pastikan slot-slot berikutnya juga masih kosong (sistem akan
            mengunci beberapa slot berurutan secara otomatis).
          </p>

          {error && (
            <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting} className="mt-1">
            {submitting ? "Menyimpan..." : "Simpan Booking"}
          </Button>
        </form>
      </div>
    </div>
  );
}

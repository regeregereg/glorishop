"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Booking, BookingStatus, STATUS_LABELS, Service, Staff, Slot } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { formatTime, getBookingServiceNames, getBookingPriceLabel, formatDateShort, toLocalDateString, formatRupiah } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { Plus, X, Check, MessageCircle, Receipt } from "lucide-react";

// Ambil nomor WA pelanggan — wa_number diprioritaskan, fallback ke phone,
// fallback ke walkin_phone. Return null jika tidak ada nomor sama sekali.
function getWaNumber(b: Booking): string | null {
  const num = (b.user as (typeof b.user & { wa_number?: string | null }) | undefined)?.wa_number
    || b.user?.phone
    || b.walkin_phone;
  return num ?? null;
}

function buildWaLink(phone: string, message: string): string {
  let p = phone.replace(/[\s-]/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("+")) p = p.slice(1);
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

// Susun pesan WA konfirmasi booking dengan format baku (kode antrian,
// layanan, DP, sisa bayar, & reminder datang 10 menit lebih awal) — supaya
// admin tidak perlu ketik manual satu-satu tiap kali chat pelanggan.
// DP/Kurang cuma ditampilkan kalau memang ada pembayaran DP yang sudah
// terkonfirmasi; untuk booking lunas atau walk-in tanpa data payment,
// baris itu otomatis disembunyikan supaya tidak muncul "DP = Rp0" yang
// membingungkan pelanggan.
function buildBookingWaMessage(booking: Booking): string {
  const name = booking.user?.name ?? booking.walkin_name ?? "Pelanggan";
  const date = booking.slot?.date ?? "";
  const time = booking.slot?.start_time ? formatTime(booking.slot.start_time) : "";
  const layanan = getBookingServiceNames(booking, 5);

  const lines = [
    `Halo kak, ini Admin Glori Barbershop 👋`,
    `Booking ${name} pada ${date} jam ${time}`,
  ];

  if (booking.booking_code) {
    lines.push(`Kode Antrian = ${booking.booking_code}`);
  }

  lines.push(`Layanan = ${layanan}`);

  if (booking.payment && booking.payment.status === "CONFIRMED") {
    const subtotal =
      booking.final_price ??
      (booking.services && booking.services.length > 0
        ? booking.services.reduce(
            (sum, s) => sum + (s.final_price ?? s.service_price ?? s.service_price_min ?? 0),
            0
          )
        : 0);
    if (booking.payment.payment_type === "DP") {
      const kurang = Math.max(subtotal - booking.payment.amount, 0);
      lines.push(`DP = ${formatRupiah(booking.payment.amount)}`);
      lines.push(`Kurang = ${formatRupiah(kurang)}`);
    } else {
      lines.push(`Status = Lunas`);
    }
  }

  lines.push(`Mohon datang 10 menit sebelum jam yang ditentukan ya kak 🙏`);
  lines.push(``);
  lines.push(`Ada yang bisa kami bantu?`);

  return lines.join("\n");
}

function WaChatButton({
  booking,
  onRequestPhone,
}: {
  booking: Booking;
  onRequestPhone: () => void;
}) {
  const waNum = getWaNumber(booking);
  if (waNum) {
    return (
      <a
        href={buildWaLink(waNum, buildBookingWaMessage(booking))}
        target="_blank"
        rel="noopener noreferrer"
        title={`Chat WA: ${waNum.startsWith("62") ? "0" + waNum.slice(2) : waNum}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366] transition-colors hover:bg-[#25D366]/25"
      >
        <MessageCircle size={15} />
      </a>
    );
  }
  return (
    <button
      title="Tambah nomor WA"
      onClick={onRequestPhone}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-dashed border-border-soft text-text-tertiary transition-colors hover:border-accent hover:text-accent"
    >
      <MessageCircle size={15} />
    </button>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "ALL">("ALL");
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [showWalkinForm, setShowWalkinForm] = useState(false);
  const [inlinePhoneId, setInlinePhoneId] = useState<string | null>(null);
  const [inlinePhone, setInlinePhone] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/bookings?checkExpiry=1");
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = bookings
    .filter((b) => statusFilter === "ALL" || b.status === statusFilter)
    .filter((b) =>
      searchCode.trim() === "" ||
      (b.booking_code ?? "").toLowerCase().includes(searchCode.trim().toLowerCase()) ||
      (b.user?.name ?? b.walkin_name ?? "").toLowerCase().includes(searchCode.trim().toLowerCase())
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Semua Booking</h1>
          <p className="mt-1 text-sm text-text-secondary">Filter berdasarkan status atau cari kode booking.</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowWalkinForm(true)}>
          Booking Walk-in
        </Button>
      </div>

      {/* Search by kode booking / nama */}
      <div className="mt-4">
        <input
          type="text"
          value={searchCode}
          onChange={(e) => setSearchCode(e.target.value)}
          placeholder="Cari kode booking (GLR-...) atau nama pelanggan"
          className="w-full rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent font-mono placeholder:font-sans"
        />
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {(["ALL", ...Object.keys(STATUS_LABELS)] as (BookingStatus | "ALL")[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              statusFilter === s
                ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
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
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Layanan</th>
              <th className="px-4 py-3">Barber</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Chat</th>
              <th className="px-4 py-3 text-right">Struk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id} className="border-b border-border-soft last:border-0">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold tracking-wider text-accent">
                    {b.booking_code ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">
                  {b.user?.name ?? b.walkin_name ?? "—"}
                  {b.walkin_by_barber && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent">
                      Walk-in Barber
                    </span>
                  )}
                  {!b.walkin_by_barber && b.created_by_admin && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-text-secondary">
                      Walk-in Admin
                    </span>
                  )}
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
                <td className="px-4 py-3 text-right">
                  {inlinePhoneId === b.id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <input
                        type="tel"
                        value={inlinePhone}
                        onChange={(e) => setInlinePhone(e.target.value)}
                        placeholder="08xx..."
                        autoFocus
                        className="w-28 rounded-lg border border-border-soft bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                      />
                      <a
                        href={inlinePhone.trim() ? buildWaLink(inlinePhone.trim(), buildBookingWaMessage(b)) : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => { if (!inlinePhone.trim()) return; setInlinePhoneId(null); setInlinePhone(""); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366] text-white disabled:opacity-40"
                      >
                        <MessageCircle size={13} />
                      </a>
                      <button
                        onClick={() => { setInlinePhoneId(null); setInlinePhone(""); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-soft text-text-tertiary"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <WaChatButton
                      booking={b}
                      onRequestPhone={() => { setInlinePhoneId(b.id); setInlinePhone(""); }}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {b.status === "DONE" ? (
                    <Link
                      href={`/admin/struk/${b.id}`}
                      target="_blank"
                      title="Cetak struk"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent transition-colors hover:bg-accent/25"
                    >
                      <Receipt size={15} />
                    </Link>
                  ) : (
                    <span
                      title="Struk hanya tersedia untuk booking yang sudah selesai"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-dashed border-border-soft text-text-tertiary"
                    >
                      <Receipt size={15} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-secondary">
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

  // Layanan home service hanya bisa dikerjakan barber tertentu (diatur
  // admin lewat halaman Kelola Layanan). Begitu salah satu terpilih,
  // dropdown barber di bawah otomatis disaring hanya menampilkan barber
  // yang memang menerima KOMBINASI layanan home service yang dipilih —
  // server tetap memvalidasi ulang ini di POST /api/bookings sebagai
  // jaga-jaga, tapi filter di UI ini supaya admin tidak salah pilih dulu.
  const selectedHomeServiceItems = services.filter(
    (s) => serviceIds.includes(s.id) && (s.is_home_service_only || s.category === "home_service")
  );
  const eligibleBarbersForWalkin =
    selectedHomeServiceItems.length === 0
      ? barbers
      : barbers.filter((b) =>
          selectedHomeServiceItems.every((s) => (s.barber_ids ?? []).includes(b.id))
        );

  useEffect(() => {
    if (selectedHomeServiceItems.length === 0) return;
    if (barberId && !eligibleBarbersForWalkin.some((b) => b.id === barberId)) {
      setBarberId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHomeServiceItems.length, eligibleBarbersForWalkin.length]);

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
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">
              Layanan (boleh pilih lebih dari satu)
            </p>
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border-soft bg-surface-2 p-2">
              {services.map((s) => {
                const checked = serviceIds.includes(s.id);
                const eff = getEffectivePrice(s, barberId || null);
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
                    <span className="flex-1">{s.name}</span>
                    {priceLabel && (
                      <span className="shrink-0 text-xs font-semibold text-text-tertiary">{priceLabel}</span>
                    )}
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
            {eligibleBarbersForWalkin.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {selectedHomeServiceItems.length > 0 && (
            <p className="text-xs text-text-tertiary">
              Daftar barber di atas sudah disaring — hanya barber yang menerima {selectedHomeServiceItems.map((s) => s.name).join(", ")} yang muncul.
            </p>
          )}
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

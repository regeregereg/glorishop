"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking } from "@/types";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState } from "@/components/ErrorState";
import { formatDateShort, formatTime, formatRupiah, getBookingServiceNames } from "@/lib/utils";
import { AlertCircle, CheckCircle2, XCircle, RefreshCw, Clock } from "lucide-react";

type StuckBooking = Booking & { _type: "booking" | "payment" };

export default function AdminResolvePage() {
  const [stuckBookings, setStuckBookings] = useState<Booking[]>([]);
  const [stuckPayments, setStuckPayments] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    booking: Booking;
    type: "booking" | "payment";
    action: "done" | "cancel" | "expire";
  } | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async (initial = false) => {
    try {
      const res = await fetch("/api/admin/resolve");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStuckBookings(data.stuckBookings ?? []);
      setStuckPayments(data.stuckPayments ?? []);
      setLoadError(false);
    } catch {
      if (initial) setLoadError(true);
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  async function handleResolve() {
    if (!confirmTarget) return;
    const { booking, type, action } = confirmTarget;
    setActingId(booking.id);
    setConfirmTarget(null);
    try {
      const res = await fetch("/api/admin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, bookingId: booking.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal memproses. Coba lagi.");
        return;
      }
      const msgs: Record<string, string> = {
        done: "Booking berhasil ditandai Selesai.",
        cancel: "Booking berhasil dibatalkan.",
        expire: "Pembayaran ditandai kadaluarsa, pelanggan bisa upload ulang.",
      };
      setSuccessMsg(msgs[action] ?? "Berhasil.");
      setTimeout(() => setSuccessMsg(""), 4000);
      await load();
    } finally {
      setActingId(null);
    }
  }

  const total = stuckBookings.length + stuckPayments.length;

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-text-secondary">
        <RefreshCw size={20} className="mx-auto animate-spin" />
        <p className="mt-3">Memeriksa data...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <ErrorState
        title="Gagal memuat data"
        message="Periksa koneksi internet lalu coba lagi."
        onRetry={() => load(true)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Resolve Data Nyangkut</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Booking yang belum selesai atau pembayaran yang belum diverifikasi lebih dari 24 jam.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw size={15} />}
          onClick={() => load()}
        >
          Refresh
        </Button>
      </div>

      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-status-done/10 px-4 py-3 text-sm font-semibold text-status-done">
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}

      {total === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface py-16 text-center">
          <CheckCircle2 size={32} className="text-status-done" />
          <p className="font-display text-base font-bold">Semua bersih!</p>
          <p className="text-sm text-text-secondary">
            Tidak ada booking atau pembayaran yang nyangkut.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">

          {/* ── BOOKING IN_PROGRESS NYANGKUT ── */}
          {stuckBookings.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Clock size={16} className="text-status-progress" />
                <h2 className="font-display text-sm font-bold text-status-progress">
                  Booking lupa dimulai/diselesaikan ({stuckBookings.length})
                </h2>
              </div>
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-status-progress/30 bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-soft bg-status-progress/5 text-left text-xs text-text-secondary">
                      <th className="px-4 py-3">Pelanggan</th>
                      <th className="px-4 py-3">Layanan</th>
                      <th className="px-4 py-3">Barber</th>
                      <th className="px-4 py-3">Jadwal</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stuckBookings.map((b) => {
                      const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
                      return (
                        <tr key={b.id} className="border-b border-border-soft last:border-0">
                          <td className="px-4 py-3 font-semibold">
                            {b.user?.name ?? b.walkin_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {getBookingServiceNames(b)}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {b.barber?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {slot ? `${formatDateShort(slot.date)} ${formatTime(slot.start_time)}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={b.status} size="sm" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                icon={<CheckCircle2 size={14} />}
                                disabled={actingId === b.id}
                                onClick={() => setConfirmTarget({ booking: b, type: "booking", action: "done" })}
                              >
                                Selesai
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<XCircle size={14} />}
                                disabled={actingId === b.id}
                                onClick={() => setConfirmTarget({ booking: b, type: "booking", action: "cancel" })}
                              >
                                Batalkan
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── PEMBAYARAN PENDING_REVIEW NYANGKUT ── */}
          {stuckPayments.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-status-cancelled" />
                <h2 className="font-display text-sm font-bold text-status-cancelled">
                  Pembayaran belum diverifikasi lebih dari 24 jam ({stuckPayments.length})
                </h2>
              </div>
              <div className="overflow-hidden rounded-[var(--radius-card)] border border-status-cancelled/30 bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-soft bg-status-cancelled/5 text-left text-xs text-text-secondary">
                      <th className="px-4 py-3">Pelanggan</th>
                      <th className="px-4 py-3">Layanan</th>
                      <th className="px-4 py-3">Jadwal</th>
                      <th className="px-4 py-3">Nominal</th>
                      <th className="px-4 py-3">Upload</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stuckPayments.map((b) => {
                      const slot = Array.isArray(b.slot) ? b.slot[0] : b.slot;
                      const payment = Array.isArray(b.payment) ? b.payment[0] : b.payment;
                      const uploadedAt = payment?.uploaded_at
                        ? new Date(payment.uploaded_at)
                        : null;
                      const hoursAgo = uploadedAt
                        ? Math.floor((Date.now() - uploadedAt.getTime()) / 3600000)
                        : null;
                      return (
                        <tr key={b.id} className="border-b border-border-soft last:border-0">
                          <td className="px-4 py-3 font-semibold">
                            {b.user?.name ?? b.walkin_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {getBookingServiceNames(b)}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {slot ? `${formatDateShort(slot.date)} ${formatTime(slot.start_time)}` : "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {payment?.amount ? formatRupiah(payment.amount) : "—"}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {hoursAgo !== null ? `${hoursAgo} jam lalu` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<XCircle size={14} />}
                                disabled={actingId === b.id}
                                onClick={() => setConfirmTarget({ booking: b, type: "payment", action: "expire" })}
                              >
                                Kadaluarkan
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-4 py-3 text-xs text-text-tertiary">
                  "Kadaluarkan" akan mereset pembayaran dan pelanggan bisa upload ulang bukti transfer.
                  Verifikasi normal tetap bisa dilakukan di menu <strong>Verifikasi Pembayaran</strong>.
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modal Konfirmasi */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-[var(--radius-card)] bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-bold">
              {confirmTarget.action === "done" && "Tandai Selesai?"}
              {confirmTarget.action === "cancel" && "Batalkan Booking?"}
              {confirmTarget.action === "expire" && "Kadaluarkan Pembayaran?"}
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              {confirmTarget.action === "done" &&
                `Booking ${confirmTarget.booking.user?.name ?? confirmTarget.booking.walkin_name ?? "pelanggan"} akan ditandai SELESAI dan pelanggan mendapat notifikasi.`}
              {confirmTarget.action === "cancel" &&
                `Booking ${confirmTarget.booking.user?.name ?? confirmTarget.booking.walkin_name ?? "pelanggan"} akan DIBATALKAN. Pelanggan mendapat notifikasi.`}
              {confirmTarget.action === "expire" &&
                `Bukti pembayaran ${confirmTarget.booking.user?.name ?? confirmTarget.booking.walkin_name ?? "pelanggan"} akan dikadaluarkan. Pelanggan bisa upload ulang.`}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setConfirmTarget(null)}
              >
                Batal
              </Button>
              <Button
                fullWidth
                onClick={handleResolve}
              >
                {confirmTarget.action === "done" && "Ya, Selesai"}
                {confirmTarget.action === "cancel" && "Ya, Batalkan"}
                {confirmTarget.action === "expire" && "Ya, Kadaluarkan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking } from "@/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatTime, formatDateShort, formatRupiah } from "@/lib/utils";
import { Eye, X, CheckCircle2, XCircle } from "lucide-react";

type Tab = "PENDING_REVIEW" | "RIWAYAT";

export default function AdminPaymentsPage() {
  const [pendingReview, setPendingReview] = useState<Booking[]>([]);
  const [history, setHistory] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<Tab>("PENDING_REVIEW");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // "Menunggu Verifikasi" perlu selalu up-to-date (admin harus cepat tanggap
  // kalau ada bukti transfer baru masuk) — makanya di-poll tiap 15 detik.
  // Tapi sekarang query-nya dipersempit ke status=PENDING saja (bukan tarik
  // SEMUA booking dari sejak toko buka tiap 15 detik seperti sebelumnya).
  // List ini secara alami tetap kecil karena begitu diverifikasi, statusnya
  // berubah dan otomatis hilang dari sini.
  const loadPending = useCallback(async (isInitialLoad = false) => {
    try {
      const expiry = isInitialLoad ? "&checkExpiry=1" : "";
      const res = await fetch(`/api/bookings?status=PENDING${expiry}`);
      if (!res.ok) throw new Error("Gagal memuat data pembayaran.");
      const data = await res.json();
      const bookings: Booking[] = data.bookings || [];
      setPendingReview(bookings.filter((b) => b.payment?.status === "PENDING_REVIEW"));
      setLoadError(false);
    } catch {
      if (isInitialLoad) setLoadError(true);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, []);

  // "Riwayat" (payment yang sudah diputuskan) TIDAK punya filter status booking
  // yang pas di API (bisa CONFIRMED/DONE/dll), jadi tetap fetch semua booking —
  // tapi sekarang cuma sekali saat halaman dibuka + setelah admin
  // konfirmasi/tolak pembayaran, BUKAN diulang tiap 15 detik selama-lamanya
  // seperti sebelumnya. Ini yang paling besar dampaknya ke beban server,
  // karena polling 15 detik tanpa henti itu jauh lebih boros daripada
  // fetch sesekali saja.
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) return;
      const data = await res.json();
      const bookings: Booking[] = data.bookings || [];
      setHistory(
        bookings.filter((b) => b.payment && (b.payment.status === "CONFIRMED" || b.payment.status === "REJECTED"))
      );
    } catch {
      // Diamkan — riwayat bukan data yang butuh real-time, tinggal coba lagi
      // lain kali tab dibuka atau setelah aksi berikutnya.
    }
  }, []);

  useEffect(() => {
    loadPending(true);
    loadHistory();
    const interval = setInterval(() => loadPending(), 15000);
    return () => clearInterval(interval);
  }, [loadPending, loadHistory]);

  const list = tab === "PENDING_REVIEW" ? pendingReview : history;

  async function openProof(paymentId: string) {
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const res = await fetch(`/api/payments/${paymentId}/proof-url`);
      const data = await res.json();
      if (res.ok) {
        setPreviewUrl(data.url);
      } else {
        alert(data.error || "Gagal memuat bukti transfer.");
      }
    } catch {
      alert("Gagal memuat bukti transfer. Periksa koneksi internet kamu.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleConfirm(booking: Booking) {
    if (!booking.payment) return;
    setActingId(booking.id);
    try {
      const res = await fetch(`/api/payments/${booking.payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal mengonfirmasi pembayaran.");
        return;
      }
      loadPending(true);
      loadHistory();
    } catch {
      alert("Gagal mengonfirmasi pembayaran. Periksa koneksi internet kamu.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget?.payment) return;
    setActingId(rejectTarget.id);
    try {
      const res = await fetch(`/api/payments/${rejectTarget.payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          rejection_reason: rejectReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menolak pembayaran.");
        return;
      }
      setRejectTarget(null);
      setRejectReason("");
      loadPending(true);
      loadHistory();
    } catch {
      alert("Gagal menolak pembayaran. Periksa koneksi internet kamu.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-extrabold">Verifikasi Pembayaran</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Cek bukti transfer pelanggan, lalu konfirmasi atau tolak.
        </p>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setTab("PENDING_REVIEW")}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            tab === "PENDING_REVIEW"
              ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
              : "border border-border-soft bg-surface text-text-secondary"
          }`}
        >
          Menunggu Verifikasi {pendingReview.length > 0 ? `(${pendingReview.length})` : ""}
        </button>
        <button
          onClick={() => setTab("RIWAYAT")}
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            tab === "RIWAYAT"
              ? "btn-order-gradient text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
              : "border border-border-soft bg-surface text-text-secondary"
          }`}
        >
          Riwayat
        </button>
      </div>

      {loadError && (
        <ErrorState
          className="mt-5"
          title="Gagal memuat data pembayaran"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={() => loadPending(true)}
        />
      )}

      {!loadError && (
      <div className="mt-5 overflow-x-auto rounded-2xl border border-border-soft">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-soft bg-surface text-left text-xs text-text-secondary">
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Layanan</th>
              <th className="px-4 py-3">Jadwal</th>
              <th className="px-4 py-3">Jenis</th>
              <th className="px-4 py-3">Nominal</th>
              <th className="px-4 py-3">Bukti</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-b border-border-soft last:border-0">
                <td className="px-4 py-3 font-semibold">{b.user?.name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">{b.service?.name ?? "—"}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {b.slot ? `${formatDateShort(b.slot.date)} ${formatTime(b.slot.start_time)}` : "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {b.payment?.payment_type === "FULL" ? "Lunas" : "DP"}
                </td>
                <td className="px-4 py-3 font-semibold text-accent">
                  {b.payment ? formatRupiah(b.payment.amount) : "—"}
                </td>
                <td className="px-4 py-3">
                  {b.payment?.proof_url ? (
                    <button
                      onClick={() => openProof(b.payment!.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-accent underline"
                    >
                      <Eye size={13} /> Lihat
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {tab === "PENDING_REVIEW" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(b)}
                        disabled={actingId === b.id}
                        icon={<CheckCircle2 size={14} />}
                      >
                        Konfirmasi
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejectTarget(b);
                          setRejectReason("");
                        }}
                        disabled={actingId === b.id}
                        icon={<XCircle size={14} />}
                      >
                        Tolak
                      </Button>
                    </div>
                  ) : (
                    <span
                      className={
                        b.payment?.status === "CONFIRMED"
                          ? "text-status-confirmed text-xs font-semibold"
                          : "text-status-cancelled text-xs font-semibold"
                      }
                    >
                      {b.payment?.status === "CONFIRMED" ? "Diterima" : "Ditolak"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                  {tab === "PENDING_REVIEW"
                    ? "Tidak ada bukti transfer yang menunggu verifikasi."
                    : "Belum ada riwayat verifikasi."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Modal preview bukti transfer */}
      {(previewLoading || previewUrl) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-bold">Bukti Transfer</p>
              <button onClick={() => setPreviewUrl(null)} className="text-text-secondary">
                <X size={20} />
              </button>
            </div>
            {previewLoading && (
              <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
            )}
            {!previewLoading && previewUrl && (
              // Sengaja TIDAK pakai next/image: proof_url adalah signed URL
              // sementara (TTL 5 menit) dari bucket privat, dan filenya bisa
              // berupa PDF (lihat accept type saat upload) — next/image hanya
              // mendukung gambar dan tidak cocok dioptimasi untuk URL yang
              // memang dirancang temporary/privat seperti ini.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Bukti transfer" className="w-full rounded-xl object-contain" />
            )}
          </div>
        </div>
      )}

      {/* Modal alasan tolak */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Tolak Pembayaran</h2>
              <button onClick={() => setRejectTarget(null)} className="text-text-secondary">
                <X size={20} />
              </button>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Booking ini akan otomatis dibatalkan dan slotnya dilepas. Pelanggan harus booking
              ulang dari awal.
            </p>
            <textarea
              placeholder="Alasan penolakan (opsional, terlihat oleh pelanggan)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <Button
              variant="danger"
              fullWidth
              className="mt-4"
              onClick={handleReject}
              disabled={actingId === rejectTarget.id}
            >
              {actingId === rejectTarget.id ? "Memproses..." : "Tolak & Batalkan Booking"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

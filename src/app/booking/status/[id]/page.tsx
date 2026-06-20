"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Booking } from "@/types";
import { Button } from "@/components/Button";
import { formatRupiah, formatDateIndo, formatTime } from "@/lib/utils";

export default function BookingPaymentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setQrisUrl(d.settings?.qris_image_url ?? null))
      .catch(() => setQrisUrl(null));
  }, []);

  async function load() {
    const me = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json());
    if (!me.user) {
      router.push(`/login?next=/booking/status/${params.id}`);
      return;
    }
    const bookingsRes = await fetch(`/api/bookings?userId=${me.user.id}`);
    const data = await bookingsRes.json();
    const found = (data.bookings || []).find((b: Booking) => b.id === params.id);
    if (!found) {
      router.push("/booking/status");
      return;
    }
    setBooking(found);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleUpload() {
    if (!proofFile || !booking) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("booking_id", booking.id);
      const res = await fetch("/api/payments/upload-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengunggah bukti transfer.");
        return;
      }
      setUploadDone(true);
      setTimeout(() => router.push("/booking/status"), 1200);
    } catch {
      setError("Gagal mengunggah bukti transfer. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg/90 px-5 py-4 backdrop-blur-lg">
        <button
          onClick={() => router.push("/booking/status")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-bold">Selesaikan Pembayaran</h1>
      </header>

      <div className="px-5 pt-5">
        {loading && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {!loading && booking && booking.status !== "WAITING_PAYMENT" && (
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            Booking ini sudah tidak menunggu pembayaran (status: {booking.status}).
          </p>
        )}

        {!loading && booking && booking.status === "WAITING_PAYMENT" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
              <p className="text-xs text-text-secondary">Layanan</p>
              <p className="font-display mt-1 text-base font-bold">
                {booking.service?.name ?? "Layanan"}
              </p>
              {booking.slot && (
                <p className="mt-1 text-xs text-text-tertiary">
                  {formatDateIndo(booking.slot.date)} • {formatTime(booking.slot.start_time)}
                </p>
              )}
            </div>

            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 text-center">
              <p className="text-xs text-text-secondary">Total yang harus dibayar</p>
              <p className="font-display mt-1 text-2xl font-bold text-accent">
                {formatRupiah(booking.payment?.amount ?? 0)}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {booking.payment?.payment_type === "FULL" ? "Bayar Lunas" : "Down Payment (DP)"}
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
              {qrisUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrisUrl} alt="QRIS Glori Barbershop" className="h-56 w-56 rounded-xl object-contain" />
              ) : (
                <p className="py-10 text-center text-sm text-text-secondary">
                  QRIS belum diatur admin. Silakan hubungi barbershop langsung.
                </p>
              )}
            </div>

            {!uploadDone ? (
              <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
                <p className="mb-2 text-sm font-medium text-text-secondary">Unggah Bukti Transfer</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border file:border-border-soft file:bg-surface-2 file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-text-primary"
                />
                {proofFile && <p className="mt-2 text-xs text-text-tertiary">{proofFile.name}</p>}
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-status-confirmed/30 bg-status-confirmed/10 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-status-confirmed">Bukti transfer terkirim!</p>
                <p className="mt-1 text-xs text-text-secondary">Mengalihkan ke status booking...</p>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {!loading && booking?.status === "WAITING_PAYMENT" && !uploadDone && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button size="lg" fullWidth onClick={handleUpload} disabled={uploading || !proofFile}>
            {uploading ? "Mengunggah..." : "Kirim Bukti Transfer"}
          </Button>
        </div>
      )}
    </div>
  );
}

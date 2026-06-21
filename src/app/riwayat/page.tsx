"use client";

import { useEffect, useState } from "react";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatDateIndo, getBookingServiceNames, getBookingPriceLabel } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Star, History } from "lucide-react";
import { cn } from "@/lib/utils";

const DONE_OR_PAST = ["DONE", "CANCELLED_USER", "CANCELLED_ADMIN", "NO_SHOW"];

export default function RiwayatPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [session, setSession] = useState<{ id: string } | null | undefined>(undefined);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat sesi.");
        return r.json();
      })
      .then((d) => {
        setSession(d.user);
        if (!d.user) router.push("/login?next=/riwayat");
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }, [router]);

  function loadBookings() {
    if (!session?.id) return;
    setLoading(true);
    setLoadError(false);
    fetch(`/api/bookings?userId=${session.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat riwayat.");
        return r.json();
      })
      .then((d) => {
        setBookings(d.bookings || []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }

  useEffect(() => {
    loadBookings();
  }, [session?.id]);

  async function submitReview(bookingId: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, rating, comment }),
      });
      if (res.ok) {
        setReviewedIds((prev) => new Set(prev).add(bookingId));
        setReviewingId(null);
        setRating(5);
        setComment("");
      } else {
        const data = await res.json();
        alert(data.error || "Gagal mengirim review.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pastBookings = bookings.filter((b) => DONE_OR_PAST.includes(b.status));

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="px-5 pt-6 pb-2">
        <h1 className="font-display text-2xl font-extrabold">Riwayat Kunjungan</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Semua booking lama dan statusnya.
        </p>
      </header>

      <div className="px-5 pt-4">
        {loading && !loadError && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {loadError && (
          <ErrorState
            title="Gagal memuat riwayat"
            message="Periksa koneksi internet kamu, lalu coba lagi."
            onRetry={loadBookings}
          />
        )}

        {!loading && !loadError && pastBookings.length === 0 && (
          <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-6 py-12 text-center">
            <History size={32} className="text-text-tertiary" />
            <p className="mt-3 font-display text-sm font-semibold">Belum ada riwayat</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {pastBookings.map((b) => (
            <div
              key={b.id}
              className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-bold">{getBookingServiceNames(b)}</p>
                  <p className="mt-1 text-xs text-text-secondary">{b.barber?.name}</p>
                </div>
                <StatusBadge status={b.status} size="sm" />
              </div>
              {b.slot && (
                <p className="mt-3 text-xs text-text-tertiary">{formatDateIndo(b.slot.date)}</p>
              )}
              <div className="my-4 h-px bg-border-soft" />
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-bold text-accent">
                  {getBookingPriceLabel(b)}
                </p>
                {b.status === "DONE" && !reviewedIds.has(b.id) && (
                  <Button size="sm" variant="secondary" onClick={() => setReviewingId(b.id)}>
                    Beri Rating
                  </Button>
                )}
                {reviewedIds.has(b.id) && (
                  <span className="text-xs text-status-done">Terima kasih atas ratingnya!</span>
                )}
              </div>

              {reviewingId === b.id && (
                <div className="mt-4 rounded-2xl border border-border-soft bg-surface-2 p-4">
                  <p className="text-xs text-text-secondary mb-2">Beri rating untuk layanan ini</p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRating(n)}>
                        <Star
                          size={26}
                          className={cn(
                            n <= rating ? "fill-accent text-accent" : "text-border-soft"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tulis ulasan (opsional)"
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm placeholder:text-text-tertiary outline-none focus:border-accent"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setReviewingId(null)}>
                      Batal
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => submitReview(b.id)}
                      disabled={submitting}
                      fullWidth
                    >
                      {submitting ? "Mengirim..." : "Kirim Rating"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

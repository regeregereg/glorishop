"use client";

import { useEffect, useState } from "react";
import { Booking, Review } from "@/types";
import { ErrorState } from "@/components/ErrorState";
import { formatDateIndo, formatRupiah, getBookingServiceNames, getBookingPriceLabel } from "@/lib/utils";
import { getBookingTotalCommission } from "@/lib/commission";
import { Star, TrendingUp, Wallet } from "lucide-react";

export default function BarberRiwayatPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(false);
    fetch("/api/barber-stats")
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat riwayat kerja.");
        return r.json();
      })
      .then((d) => {
        setBookings(d.bookings || []);
        setReviews(d.reviews || []);
        setAvgRating(d.avgRating);
        setTotalCompleted(d.totalCompleted || 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }

  useEffect(() => {
    load();
  }, []);

  if (loadError) {
    return (
      <div className="px-5 pt-6">
        <h1 className="font-display text-2xl font-extrabold">Riwayat Kerja</h1>
        <ErrorState
          className="mt-5"
          title="Gagal memuat riwayat kerja"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={load}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <h1 className="font-display text-2xl font-extrabold">Riwayat Kerja</h1>
        <p className="mt-10 text-center text-sm text-text-secondary">Memuat...</p>
      </div>
    );
  }

  // Total komisi dari SEMUA booking DONE yang sudah dimuat (lihat
  // /api/barber-stats — hanya mengambil booking berstatus DONE).
  const totalCommission = bookings.reduce((sum, b) => sum + getBookingTotalCommission(b), 0);

  return (
    <div className="px-5 pt-6">
      <h1 className="font-display text-2xl font-extrabold">Riwayat Kerja</h1>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-soft bg-surface p-4">
          <p className="flex items-center gap-1 text-xs text-text-secondary">
            <TrendingUp size={13} /> Total Selesai
          </p>
          <p className="font-display mt-1 text-2xl font-extrabold">{totalCompleted}</p>
        </div>
        <div className="rounded-2xl border border-border-soft bg-surface p-4">
          <p className="flex items-center gap-1 text-xs text-text-secondary">
            <Star size={13} className="fill-accent text-accent" /> Rating Rata-rata
          </p>
          <p className="font-display mt-1 text-2xl font-extrabold text-accent">
            {avgRating ? avgRating.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Wallet size={16} />
        </div>
        <div>
          <p className="text-xs text-text-secondary">Total komisi (semua riwayat)</p>
          <p className="font-display text-base font-bold text-accent">{formatRupiah(totalCommission)}</p>
        </div>
      </div>

      <h2 className="font-display mt-7 text-sm font-bold text-text-secondary uppercase tracking-wide">
        Ulasan Terbaru
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {reviews.slice(0, 5).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border-soft bg-surface p-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={14}
                  className={n <= r.rating ? "fill-accent text-accent" : "text-border-soft"}
                />
              ))}
            </div>
            {r.comment && <p className="mt-2 text-sm text-text-secondary">{r.comment}</p>}
          </div>
        ))}
        {reviews.length === 0 && !loading && (
          <p className="text-sm text-text-tertiary">Belum ada ulasan.</p>
        )}
      </div>

      <h2 className="font-display mt-7 text-sm font-bold text-text-secondary uppercase tracking-wide">
        Riwayat Pekerjaan
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {bookings.slice(0, 10).map((b) => {
          const commission = getBookingTotalCommission(b);
          return (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface p-4"
            >
              <div>
                <p className="text-sm font-semibold">{getBookingServiceNames(b)}</p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {b.user?.name ?? b.walkin_name} • {b.slot ? formatDateIndo(b.slot.date) : ""}
                  {b.walkin_by_barber && " • Walk-in"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-accent">
                  {getBookingPriceLabel(b)}
                </p>
                {commission > 0 && (
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    Komisi {formatRupiah(commission)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {bookings.length === 0 && !loading && (
          <p className="text-sm text-text-tertiary">Belum ada riwayat pekerjaan.</p>
        )}
      </div>
    </div>
  );
}

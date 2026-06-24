"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatDateIndo, formatTime, getBookingServiceNames, getBookingPriceLabel, formatRupiah } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

const ACTIVE_STATUSES = ["WAITING_PAYMENT", "PENDING", "CONFIRMED", "IN_PROGRESS"];

export default function BookingStatusPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [session, setSession] = useState<{ id: string } | null | undefined>(undefined);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat sesi.");
        return r.json();
      })
      .then((d) => {
        setSession(d.user);
        if (!d.user) {
          router.replace("/login?next=/booking/status");
        }
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }, [router]);

  // isInitialLoad: hanya tampilkan layar error penuh untuk pemuatan
  // pertama. Kalau gagal di polling berikutnya (koneksi sempat putus
  // sebentar), diamkan saja — data lama tetap tampil, dicoba lagi
  // otomatis di siklus polling berikutnya 15 detik kemudian.
  async function loadBookings(userId: string, isInitialLoad = false) {
    try {
      const res = await fetch(`/api/bookings?userId=${userId}`);
      if (!res.ok) throw new Error("Gagal memuat booking.");
      const data = await res.json();
      setBookings(data.bookings || []);
      setLoadError(false);
    } catch {
      if (isInitialLoad) setLoadError(true);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.id) {
      loadBookings(session.id, true);
      // Polling setiap 15 detik sesuai catatan developer (real-time status)
      const interval = setInterval(() => loadBookings(session.id), 15000);
      return () => clearInterval(interval);
    }
  }, [session?.id]);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED_USER" }),
      });
      const data = await res.json();
      if (res.ok && session?.id) {
        loadBookings(session.id, true);
      } else {
        alert(data.error || "Gagal membatalkan booking.");
      }
    } catch {
      alert("Gagal membatalkan booking. Periksa koneksi internet kamu.");
    } finally {
      setCancellingId(null);
    }
  }

  const activeBookings = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="px-5 pt-6 pb-2">
        <h1 className="font-display text-2xl font-extrabold">Status Booking</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Pantau jadwal booking kamu yang aktif di sini.
        </p>
      </header>

      <div className="px-5 pt-4">
        {loading && !loadError && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {loadError && (
          <ErrorState
            title="Gagal memuat status booking"
            message="Periksa koneksi internet kamu, lalu coba lagi."
            onRetry={() => session?.id && loadBookings(session.id, true)}
          />
        )}

        {!loading && !loadError && activeBookings.length === 0 && (
          <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-6 py-12 text-center">
            <Clock size={32} className="text-text-tertiary" />
            <p className="mt-3 font-display text-sm font-semibold">
              Belum ada booking aktif
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Yuk booking layanan favoritmu sekarang.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {activeBookings.map((b) => (
            <div
              key={b.id}
              className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-base font-bold">
                    {getBookingServiceNames(b)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {b.barber?.name ?? "Barber"} •{" "}
                    {b.slot ? formatTime(b.slot.start_time) : ""}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>

              {b.slot && (
                <p className="mt-3 text-xs text-text-tertiary">
                  {formatDateIndo(b.slot.date)}
                </p>
              )}

              {b.payment && (
                <div className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">
                      {b.payment.payment_type === "FULL" ? "Bayar Lunas" : "DP"}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {formatRupiah(b.payment.amount)}
                    </span>
                  </div>
                  {b.status === "WAITING_PAYMENT" && (
                    <p className="mt-1 text-xs text-status-pending">
                      Belum ada bukti transfer. Selesaikan sebelum waktu habis.
                    </p>
                  )}
                  {b.status === "PENDING" && (
                    <p className="mt-1 text-xs text-status-pending">
                      Bukti transfer terkirim, menunggu verifikasi admin.
                    </p>
                  )}
                </div>
              )}

              <div className="my-4 h-px bg-border-soft" />

              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-bold text-accent">
                  {getBookingPriceLabel(b)}
                </p>
                <div className="flex items-center gap-2">
                  {b.status === "WAITING_PAYMENT" && (
                    <Link href={`/booking/status/${b.id}`}>
                      <Button size="sm">Bayar Sekarang</Button>
                    </Link>
                  )}
                  {(b.status === "WAITING_PAYMENT" ||
                    b.status === "PENDING" ||
                    b.status === "CONFIRMED") && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleCancel(b.id)}
                      disabled={cancellingId === b.id}
                    >
                      {cancellingId === b.id ? "Membatalkan..." : "Batalkan"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

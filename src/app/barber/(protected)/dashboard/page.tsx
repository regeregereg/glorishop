"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatTime, getBookingServiceNames, getBookingPriceLabel, toLocalDateString } from "@/lib/utils";
import { Play, Check, Star } from "lucide-react";

export default function BarberDashboardPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

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

  return (
    <div className="px-5 pt-6">
      <h1 className="font-display text-2xl font-extrabold">Hai, {staffName.split(" ")[0] || "Barber"} 👋</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Antrian klien kamu hari ini.
      </p>

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
                <Button
                  size="lg"
                  fullWidth
                  variant="secondary"
                  icon={<Check size={18} />}
                  onClick={() => updateStatus(b.id, "DONE")}
                  disabled={actingId === b.id}
                >
                  Selesai
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-text-tertiary">
        <Star size={14} className="fill-accent text-accent" />
        Lihat riwayat dan rating kamu di tab Riwayat
      </div>
    </div>
  );
}

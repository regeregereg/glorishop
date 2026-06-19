"use client";

import { useEffect, useState } from "react";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { formatDateIndo, formatTime, formatServicePrice } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS"];

export default function BookingStatusPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ id: string } | null | undefined>(undefined);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setSession(d.user);
        if (!d.user) {
          router.push("/login?next=/booking/status");
        }
      });
  }, [router]);

  async function loadBookings(userId: string) {
    const res = await fetch(`/api/bookings?userId=${userId}`);
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }

  useEffect(() => {
    if (session?.id) {
      loadBookings(session.id);
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
        loadBookings(session.id);
      } else {
        alert(data.error || "Gagal membatalkan booking.");
      }
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
        {loading && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}

        {!loading && activeBookings.length === 0 && (
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
                    {b.service?.name ?? "Layanan"}
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

              <div className="my-4 h-px bg-border-soft" />

              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-bold text-accent">
                  {b.service ? formatServicePrice(b.service) : ""}
                </p>
                {(b.status === "PENDING" || b.status === "CONFIRMED") && (
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
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

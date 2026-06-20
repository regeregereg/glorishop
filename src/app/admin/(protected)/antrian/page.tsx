"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { formatTime, formatServicePrice, toLocalDateString } from "@/lib/utils";
import { Check, X } from "lucide-react";

export default function AdminAntrianPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const today = toLocalDateString(new Date());

  const load = useCallback(async () => {
    const res = await fetch(`/api/bookings?date=${today}`);
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setActingId(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) load();
      else {
        const data = await res.json();
        alert(data.error || "Gagal update.");
      }
    } finally {
      setActingId(null);
    }
  }

  // Untuk booking pelanggan yang punya bukti transfer (payment.status === PENDING_REVIEW),
  // konfirmasi/tolak harus lewat endpoint /api/payments/[id] (bukan PATCH bookings langsung),
  // supaya nominal pembayaran ikut diverifikasi & trigger pelepasan slot tetap konsisten.
  async function decidePayment(booking: Booking, action: "CONFIRM" | "REJECT") {
    if (!booking.payment) return;
    setActingId(booking.id);
    try {
      const res = await fetch(`/api/payments/${booking.payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) load();
      else {
        const data = await res.json();
        alert(data.error || "Gagal update pembayaran.");
      }
    } finally {
      setActingId(null);
    }
  }

  const grouped = bookings
    .filter((b) => !["CANCELLED_USER", "CANCELLED_ADMIN"].includes(b.status))
    .reduce<Record<string, Booking[]>>((acc, b) => {
      const key = b.barber?.name ?? "Belum ditentukan";
      (acc[key] ??= []).push(b);
      return acc;
    }, {});

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Antrian Hari Ini</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Konfirmasi booking yang masuk dan pantau antrian per barber.
      </p>

      {loading && <p className="mt-8 text-sm text-text-secondary">Memuat...</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {Object.entries(grouped).map(([barberName, list]) => (
          <div key={barberName}>
            <h2 className="font-display mb-3 text-sm font-bold text-text-secondary uppercase tracking-wide">
              {barberName}
            </h2>
            <div className="flex flex-col gap-3">
              {list
                .sort((a, b) => (a.slot?.start_time ?? "").localeCompare(b.slot?.start_time ?? ""))
                .map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-border-soft bg-surface p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {b.user?.name ?? b.walkin_name ?? "Pelanggan"}
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {b.service?.name} • {b.slot ? formatTime(b.slot.start_time) : ""}
                        </p>
                      </div>
                      <StatusBadge status={b.status} size="sm" />
                    </div>
                    <p className="mt-2 text-sm font-bold text-accent">
                      {b.service ? formatServicePrice(b.service) : ""}
                    </p>

                    {b.status === "PENDING" && b.payment && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          fullWidth
                          icon={<Check size={15} />}
                          onClick={() => decidePayment(b, "CONFIRM")}
                          disabled={actingId === b.id}
                        >
                          Konfirmasi
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          fullWidth
                          icon={<X size={15} />}
                          onClick={() => decidePayment(b, "REJECT")}
                          disabled={actingId === b.id}
                        >
                          Tolak
                        </Button>
                      </div>
                    )}
                    {b.status === "PENDING" && !b.payment && (
                      // Walk-in dari admin: tidak ada flow pembayaran online,
                      // langsung konfirmasi/tolak biasa.
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          fullWidth
                          icon={<Check size={15} />}
                          onClick={() => updateStatus(b.id, "CONFIRMED")}
                          disabled={actingId === b.id}
                        >
                          Konfirmasi
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          fullWidth
                          icon={<X size={15} />}
                          onClick={() => updateStatus(b.id, "CANCELLED_ADMIN")}
                          disabled={actingId === b.id}
                        >
                          Tolak
                        </Button>
                      </div>
                    )}
                    {b.status === "WAITING_PAYMENT" && (
                      <p className="mt-3 text-xs text-status-pending">
                        Menunggu pelanggan mengunggah bukti transfer.
                      </p>
                    )}
                    {b.status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="mt-3"
                        fullWidth
                        onClick={() => updateStatus(b.id, "CANCELLED_ADMIN")}
                        disabled={actingId === b.id}
                      >
                        Batalkan
                      </Button>
                    )}
                  </div>
                ))}
              {list.length === 0 && (
                <p className="text-sm text-text-tertiary">Belum ada antrian.</p>
              )}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && !loading && (
          <p className="text-sm text-text-secondary">Belum ada booking hari ini.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatRupiah, formatTime, getBookingServiceNames } from "@/lib/utils";
import { Wallet, Clock, Users, CheckCircle2, Megaphone } from "lucide-react";
import Link from "next/link";

interface BarberPerf {
  id: string;
  name: string;
  total: number;
  done: number;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<{
    todayBookings: Booking[];
    omsetHariIni: number;
    pendingCount: number;
    activeCount: number;
    doneCount: number;
    barberPerformance: BarberPerf[];
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  // isInitialLoad: layar error penuh hanya untuk pemuatan pertama. Kalau
  // polling 20 detik berikutnya gagal, diamkan saja — dashboard yang sudah
  // tampil tetap ada, dicoba lagi otomatis di siklus berikutnya.
  function load(isInitialLoad = false) {
    fetch("/api/admin-stats")
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat dashboard.");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoadError(false);
      })
      .catch(() => {
        if (isInitialLoad) setLoadError(true);
      });
  }

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(), 20000);
    return () => clearInterval(interval);
  }, []);

  if (loadError) {
    return (
      <ErrorState
        title="Gagal memuat dashboard"
        message="Periksa koneksi internet kamu, lalu coba lagi."
        onRetry={() => load(true)}
      />
    );
  }

  if (!data) {
    return <p className="text-sm text-text-secondary">Memuat dashboard...</p>;
  }

  const recentBookings = data.todayBookings.slice(0, 6);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Dashboard</h1>
      <p className="mt-1 text-sm text-text-secondary">Ringkasan operasional hari ini.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Wallet size={18} />}
          label="Omset Hari Ini"
          value={formatRupiah(data.omsetHariIni)}
        />
        <StatCard icon={<Clock size={18} />} label="Menunggu Konfirmasi" value={String(data.pendingCount)} />
        <StatCard icon={<Users size={18} />} label="Antrian Aktif" value={String(data.activeCount)} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Selesai Hari Ini" value={String(data.doneCount)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Booking Terbaru</h2>
            <Link href="/admin/bookings" className="text-xs font-semibold text-accent">
              Lihat semua
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {recentBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {b.user?.name ?? b.walkin_name ?? "Pelanggan"}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {getBookingServiceNames(b)} • {b.barber?.name} •{" "}
                    {b.slot ? formatTime(b.slot.start_time) : ""}
                  </p>
                </div>
                <StatusBadge status={b.status} size="sm" />
              </div>
            ))}
            {recentBookings.length === 0 && (
              <p className="py-8 text-center text-sm text-text-secondary">
                Belum ada booking hari ini.
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-display text-base font-bold">Performa Barber</h2>
          <div className="mt-3 flex flex-col gap-3">
            {data.barberPerformance.map((bp) => (
              <div
                key={bp.id}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3.5"
              >
                <p className="text-sm font-semibold">{bp.name}</p>
                <p className="text-xs text-text-secondary">
                  {bp.done}/{bp.total} selesai
                </p>
              </div>
            ))}
            {data.barberPerformance.length === 0 && (
              <p className="text-sm text-text-secondary">Belum ada data barber.</p>
            )}
          </div>
        </div>
      </div>

      <BroadcastWidget />
    </div>
  );
}

function BroadcastWidget() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setResult("");
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `Tersimpan untuk ${data.sent} pelanggan, ${data.pushSent ?? 0} di antaranya menerima notifikasi langsung.`
        );
        setMessage("");
      } else {
        setResult(data.error || "Gagal mengirim.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-accent" />
        <h2 className="font-display text-base font-bold">Broadcast Notifikasi</h2>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Kirim info promo atau pengumuman ke semua pelanggan terdaftar.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Contoh: Promo akhir pekan, diskon 20% untuk semua treatment!"
        className="mt-3 w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
      {result && <p className="mt-2 text-xs text-accent">{result}</p>}
      <Button size="sm" className="mt-3" onClick={handleSend} disabled={sending}>
        {sending ? "Mengirim..." : "Kirim Broadcast"}
      </Button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
        {icon}
      </div>
      <p className="mt-3 text-xs text-text-secondary">{label}</p>
      <p className="font-display mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

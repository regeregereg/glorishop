"use client";

import { useEffect, useState } from "react";
import { Booking } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import {
  formatRupiah,
  formatTime,
  formatRelativeTime,
  getBookingServiceNames,
} from "@/lib/utils";
import {
  Wallet,
  Clock,
  Users,
  CheckCircle2,
  Megaphone,
  AlertCircle,
  Bell,
  Scissors,
  HandCoins,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface BarberPerf {
  id: string;
  name: string;
  total: number;
  done: number;
  slotTotal: number;
  slotKosong: number;
}
interface PembayaranMenunggu {
  bookingId: string;
  paymentId: string;
  customerName: string;
  amount: number;
  uploadedAt: string;
  slotDate: string | null;
  slotTime: string | null;
}
interface BookingTerlambat {
  bookingId: string;
  barberId: string;
  barberName: string;
  customerName: string;
  slotDate: string | null;
  slotTime: string | null;
}
interface AdminNotification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  sent_at: string;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<{
    todayBookings: Booking[];
    omsetHariIni: number;
    komisiHariIni: number;
    pendingCount: number;
    activeCount: number;
    doneCount: number;
    walkinByBarberCount: number;
    barberPerformance: BarberPerf[];
    pembayaranMenungguVerifikasi: PembayaranMenunggu[];
    bookingTerlambat: BookingTerlambat[];
    notifications: AdminNotification[];
    unreadNotificationCount: number;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [showAllNotif, setShowAllNotif] = useState(false);

  // isInitialLoad: layar error penuh hanya untuk pemuatan pertama. Kalau
  // polling 20 detik berikutnya gagal, diamkan saja — dashboard yang sudah
  // tampil tetap ada, dicoba lagi otomatis di siklus berikutnya. Polling
  // ini juga jadi "pengganti" notifikasi real-time: walau push belum aktif
  // di device admin, dashboard tetap update sendiri tiap 20 detik.
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

  async function markAllNotifRead() {
    if (!data || data.unreadNotificationCount === 0) return;
    // Optimistic update — supaya badge langsung hilang tanpa nunggu round-trip.
    setData((prev) =>
      prev
        ? {
            ...prev,
            unreadNotificationCount: 0,
            notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
          }
        : prev
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch {
      // Diamkan — paling buruk badge muncul lagi di refresh berikutnya,
      // tidak fatal.
    }
  }

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
  const visibleNotifications = showAllNotif ? data.notifications : data.notifications.slice(0, 5);

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Dashboard</h1>
      <p className="mt-1 text-sm text-text-secondary">Ringkasan operasional hari ini.</p>

      {/* ALERT: booking IN_PROGRESS yang barber lupa klik "Selesai" */}
      {data.bookingTerlambat.length > 0 && (
        <div className="mt-5 rounded-[var(--radius-card)] border border-status-progress/40 bg-status-progress/10 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-status-progress" />
            <h2 className="font-display text-sm font-bold text-status-progress">
              {data.bookingTerlambat.length} booking belum ditandai selesai
            </h2>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Barber kemungkinan lupa klik &ldquo;Selesai&rdquo;. Tandai manual lewat halaman Booking.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {data.bookingTerlambat.map((b) => (
              <Link
                key={b.bookingId}
                href={`/admin/bookings`}
                className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5 transition-colors hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm font-semibold">{b.customerName}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {b.barberName} • {b.slotDate} {b.slotTime ? b.slotTime.slice(0, 5) : ""}
                  </p>
                </div>
                <ArrowRight size={15} className="text-status-progress" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ALERT PALING ATAS & PALING MENCOLOK: pembayaran yang sudah upload
          bukti transfer dan menunggu admin verifikasi. Ini paling urgent
          karena pelanggan sedang menunggu di halaman status booking-nya —
          kalau terlambat diverifikasi, pelanggan bisa kebingungan/kecewa. */}
      {data.pembayaranMenungguVerifikasi.length > 0 && (
        <div className="mt-5 rounded-[var(--radius-card)] border border-status-cancelled/40 bg-status-cancelled/10 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-status-cancelled" />
            <h2 className="font-display text-sm font-bold text-status-cancelled">
              {data.pembayaranMenungguVerifikasi.length} pembayaran menunggu verifikasi
            </h2>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {data.pembayaranMenungguVerifikasi.slice(0, 4).map((p) => (
              <Link
                key={p.paymentId}
                href={`/admin/pembayaran`}
                className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5 transition-colors hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm font-semibold">{p.customerName}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {formatRupiah(p.amount)} • Upload {formatRelativeTime(p.uploadedAt)}
                  </p>
                </div>
                <ArrowRight size={15} className="text-status-cancelled" />
              </Link>
            ))}
          </div>
          {data.pembayaranMenungguVerifikasi.length > 4 && (
            <Link
              href="/admin/pembayaran"
              className="mt-2 inline-block text-xs font-semibold text-status-cancelled"
            >
              +{data.pembayaranMenungguVerifikasi.length - 4} lainnya — lihat semua
            </Link>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<Wallet size={18} />}
          label="Omset Hari Ini"
          value={formatRupiah(data.omsetHariIni)}
        />
        <StatCard
          icon={<HandCoins size={18} />}
          label="Komisi Barber Hari Ini"
          value={formatRupiah(data.komisiHariIni)}
        />
        <StatCard icon={<Clock size={18} />} label="Menunggu Konfirmasi" value={String(data.pendingCount)} />
        <StatCard icon={<Users size={18} />} label="Antrian Aktif" value={String(data.activeCount)} />
        <StatCard icon={<CheckCircle2 size={18} />} label="Selesai Hari Ini" value={String(data.doneCount)} />
        <StatCard
          icon={<Scissors size={18} />}
          label="Walk-in oleh Barber"
          value={String(data.walkinByBarberCount)}
        />
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
                    {b.walkin_by_barber && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent">
                        Walk-in Barber
                      </span>
                    )}
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

          {/* KAPASITAS HARI INI PER BARBER — supaya admin tahu siapa yang
              jadwalnya masih longgar/sudah penuh tanpa harus buka Kelola
              Slot satu-satu per barber. */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">Kapasitas Hari Ini</h2>
              <Link href="/admin/slot" className="text-xs font-semibold text-accent">
                Kelola Slot
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {data.barberPerformance.map((bp) => (
                <div
                  key={bp.id}
                  className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarClock size={15} className="text-text-tertiary" />
                    <p className="text-sm font-semibold">{bp.name}</p>
                  </div>
                  {bp.slotTotal === 0 ? (
                    <span className="text-xs font-semibold text-status-cancelled">
                      Belum ada slot diatur
                    </span>
                  ) : bp.slotKosong === 0 ? (
                    <span className="text-xs font-semibold text-status-cancelled">Penuh</span>
                  ) : (
                    <span className="text-xs font-semibold text-accent">
                      {bp.slotKosong}/{bp.slotTotal} slot kosong
                    </span>
                  )}
                </div>
              ))}
              {data.barberPerformance.length === 0 && (
                <p className="text-sm text-text-secondary">Belum ada data barber.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-8">
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

          {/* NOTIFIKASI TERBARU — log in-app yang selalu ada terlepas dari
              push aktif/tidak di device admin (push bisa gagal/belum
              di-setup, ini fallback yang selalu bisa diandalkan). */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-accent" />
                <h2 className="font-display text-base font-bold">Notifikasi</h2>
                {data.unreadNotificationCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-cancelled px-1.5 text-[10px] font-bold text-white">
                    {data.unreadNotificationCount}
                  </span>
                )}
              </div>
              {data.unreadNotificationCount > 0 && (
                <button
                  onClick={markAllNotifRead}
                  className="text-xs font-semibold text-text-secondary hover:text-accent"
                >
                  Tandai dibaca
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`rounded-2xl border px-3.5 py-3 ${
                    n.is_read
                      ? "border-border-soft bg-surface"
                      : "border-accent/40 bg-accent-soft"
                  }`}
                >
                  <p className="text-xs leading-relaxed text-text-primary">{n.message}</p>
                  <p className="mt-1 text-[10px] text-text-tertiary">
                    {formatRelativeTime(n.sent_at)}
                  </p>
                </div>
              ))}
              {data.notifications.length === 0 && (
                <p className="text-sm text-text-secondary">Belum ada notifikasi.</p>
              )}
              {!showAllNotif && data.notifications.length > 5 && (
                <button
                  onClick={() => setShowAllNotif(true)}
                  className="text-xs font-semibold text-accent"
                >
                  Lihat {data.notifications.length - 5} lainnya
                </button>
              )}
            </div>
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

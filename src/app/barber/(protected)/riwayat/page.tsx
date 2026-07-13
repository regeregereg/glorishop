"use client";

import { useEffect, useState, useCallback } from "react";
import { Booking, Review } from "@/types";
import { ErrorState } from "@/components/ErrorState";
import { formatDateIndo, formatRupiah, getBookingServiceNames, getBookingPriceLabel, toLocalDateString } from "@/lib/utils";
import { getBookingTotalCommission } from "@/lib/commission";
import { Star, TrendingUp, Wallet, Banknote, QrCode } from "lucide-react";

// Booking + rincian metode bayar yang dihitung di /api/barber-stats — dipakai
// supaya barber bisa cocokkan tiap transaksi (cash / TF-QR / sebagian DP)
// terhadap uang fisik yang dipegangnya di akhir hari.
type BookingWithPayment = Booking & {
  paymentMethod: "cash" | "qris" | "mixed";
  cashPortion: number;
  tfPortion: number;
};

// Preset rentang tanggal cepat, pola sama seperti di halaman Laporan admin.
// "today" jadi default sekarang — supaya begitu barber buka Riwayat Kerja
// pas mau closing/tutup kasir, langsung kelihatan transaksi HARI INI tanpa
// perlu pilih apa-apa dulu. "Semua" tetap ada, tinggal satu klik kalau mau
// lihat histori lebih jauh.
type DatePreset = "today" | "all" | "7d" | "30d" | "thisMonth";

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  if (preset === "all") return null;
  if (preset === "today") {
    const todayStr = toLocalDateString(now);
    return { from: todayStr, to: todayStr };
  }
  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toLocalDateString(from), to: toLocalDateString(now) };
  }
  if (preset === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: toLocalDateString(from), to: toLocalDateString(now) };
  }
  // thisMonth
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toLocalDateString(from), to: toLocalDateString(now) };
}

export default function BarberRiwayatPage() {
  const [preset, setPreset] = useState<DatePreset>("today");
  const [bookings, setBookings] = useState<BookingWithPayment[]>([]);
  const [cashTotal, setCashTotal] = useState(0);
  const [tfTotal, setTfTotal] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    const range = getPresetRange(preset);
    const qs = range ? `?from=${range.from}&to=${range.to}` : "";
    fetch(`/api/barber-stats${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat riwayat kerja.");
        return r.json();
      })
      .then((d) => {
        setBookings(d.bookings || []);
        setCashTotal(d.cashTotal || 0);
        setTfTotal(d.tfTotal || 0);
        setReviews(d.reviews || []);
        setAvgRating(d.avgRating);
        setTotalCompleted(d.totalCompleted || 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setLoadError(true);
      });
  }, [preset]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Rincian jumlah & total per JENIS layanan pada periode yang dipilih —
  // supaya barber bisa cocokkan "hari ini saya kerjain 3x Haircut Dewasa,
  // 1x Creambath" dari ingatan/catatan manualnya sendiri terhadap yang
  // tercatat di sistem, bukan cuma lihat total uang keseluruhan.
  const serviceBreakdown: { name: string; count: number; total: number }[] = (() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    const add = (name: string, price: number) => {
      const existing = map.get(name) ?? { name, count: 0, total: 0 };
      existing.count += 1;
      existing.total += price;
      map.set(name, existing);
    };
    bookings.forEach((b) => {
      if (b.services && b.services.length > 0) {
        b.services.forEach((s) => {
          const price = s.final_price ?? s.service_price ?? s.service_price_min ?? 0;
          add(s.service_name, price);
        });
      } else if (b.service) {
        // Fallback untuk booking lama yang belum punya baris booking_services
        const price = b.final_price ?? b.service.price ?? b.service.price_min ?? 0;
        add(b.service.name, price);
      }
    });
    return Array.from(map.values()).sort((a, c) => c.count - a.count);
  })();

  return (
    <div className="px-5 pt-6">
      <h1 className="font-display text-2xl font-extrabold">Riwayat Kerja</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            { key: "today", label: "Hari Ini" },
            { key: "all", label: "Semua" },
            { key: "7d", label: "7 Hari" },
            { key: "30d", label: "30 Hari" },
            { key: "thisMonth", label: "Bulan Ini" },
          ] as { key: DatePreset; label: string }[]
        ).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              preset === p.key
                ? "bg-accent text-black"
                : "border border-border-soft bg-surface text-text-secondary hover:bg-surface-2"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

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
          <p className="text-xs text-text-secondary">
            Total komisi {preset === "all" ? "(semua riwayat)" : "(periode ini)"}
          </p>
          <p className="font-display text-base font-bold text-accent">{formatRupiah(totalCommission)}</p>
        </div>
      </div>

      {/* Rincian Cash vs TF/QR — sengaja CUMA muncul di preset "Hari Ini"
          (bukan minta admin). Alasannya: ini dipakai buat cocokkan uang
          fisik di tangan pas closing/tutup kasir HARI ITU JUGA — kalau
          ditampilkan untuk 7/30 hari atau bulan ini, angkanya nggak ada
          gunanya buat dicocokkan ke uang cash yang sudah lama disetor. */}
      {preset === "today" && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Banknote size={16} />
              </div>
              <div>
                <p className="text-xs text-text-secondary">Cash</p>
                <p className="font-display text-sm font-bold">{formatRupiah(cashTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <QrCode size={16} />
              </div>
              <div>
                <p className="text-xs text-text-secondary">TF/QR</p>
                <p className="font-display text-sm font-bold">{formatRupiah(tfTotal)}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
            Cocokkan angka "Cash" di atas dengan uang tunai yang ada di tangan hari ini.
            Kalau beda, cek satu-satu di daftar "Riwayat Pekerjaan" di bawah — tiap
            transaksi ditandai metode bayarnya.
          </p>
        </>
      )}

      {/* Rincian per jenis layanan — buat barber cocokin dari ingatan/catatan
          sendiri ("tadi saya 3x Haircut, 1x Creambath") ke data sistem. */}
      <h2 className="font-display mt-7 text-sm font-bold text-text-secondary uppercase tracking-wide">
        Rincian Layanan {preset === "all" ? "" : "(Periode Ini)"}
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {serviceBreakdown.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-text-secondary">{s.count}x dikerjakan</p>
            </div>
            <p className="text-sm font-bold text-accent">{formatRupiah(s.total)}</p>
          </div>
        ))}
        {serviceBreakdown.length === 0 && !loading && (
          <p className="text-sm text-text-tertiary">Belum ada layanan yang dikerjakan.</p>
        )}
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
        {(preset === "all" ? bookings.slice(0, 20) : bookings).map((b) => {
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
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    b.paymentMethod === "qris"
                      ? "bg-accent-soft text-accent"
                      : b.paymentMethod === "mixed"
                      ? "bg-amber-500/15 text-amber-500"
                      : "bg-border-soft text-text-secondary"
                  }`}
                >
                  {b.paymentMethod === "qris" ? <QrCode size={10} /> : <Banknote size={10} />}
                  {b.paymentMethod === "qris"
                    ? "TF/QR"
                    : b.paymentMethod === "mixed"
                    ? "DP TF + Sisa Cash"
                    : "Cash"}
                </span>
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
        {preset === "all" && bookings.length > 20 && (
          <p className="text-center text-[11px] text-text-tertiary">
            Menampilkan 20 transaksi terbaru. Pilih preset "7 Hari"/"30 Hari"/"Bulan Ini" di atas
            untuk lihat semua transaksi periode tertentu (buat cocokin kas).
          </p>
        )}
      </div>
    </div>
  );
}

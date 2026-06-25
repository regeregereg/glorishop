"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RefreshCw, Monitor, Clock } from "lucide-react";

interface QrData {
  token: string;
  svg: string;
  remaining: number;
  windowSeconds: number;
}

export default function AdminQrDisplayPage() {
  const [qr, setQr]             = useState<QrData | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef            = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance-qr", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const d: QrData = await res.json();
      setQr(d);
      setCountdown(d.remaining);
      setError("");
    } catch {
      setError("Gagal memuat QR. Periksa koneksi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQr();

    // Poll setiap 30 detik untuk refresh QR dari server
    intervalRef.current = setInterval(fetchQr, 30_000);

    // Countdown tiap detik
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Window habis — fetch QR baru segera
          fetchQr();
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchQr]);

  // Progress bar: sisa waktu / total window
  const progress = qr ? (countdown / qr.windowSeconds) * 100 : 100;

  // Warna countdown: hijau > kuning > merah
  const countdownColor =
    countdown > 60 ? "text-status-done" :
    countdown > 20 ? "text-yellow-500" :
    "text-status-cancelled";

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 text-accent">
          <Monitor size={20} />
          <p className="font-display text-lg font-bold">QR Absensi Glori</p>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          Pajang halaman ini di layar kasir. Barber scan untuk absen.
        </p>
      </div>

      {/* QR Card */}
      <div className="w-full max-w-sm rounded-3xl border border-border-soft bg-surface p-8 shadow-sm">
        {loading && (
          <div className="flex h-72 items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {error && !loading && (
          <div className="flex h-72 flex-col items-center justify-center gap-3">
            <p className="text-center text-sm text-status-cancelled">{error}</p>
            <button
              onClick={fetchQr}
              className="rounded-xl border border-border-soft px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {qr && !loading && !error && (
          <>
            {/* QR SVG */}
            <div
              className="mx-auto w-fit rounded-2xl bg-white p-3"
              dangerouslySetInnerHTML={{ __html: qr.svg }}
            />

            {/* Progress bar */}
            <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-border-soft">
              <div
                className="h-full rounded-full bg-accent transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Countdown */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Clock size={12} />
                QR berubah tiap 5 menit
              </div>
              <p className={`font-display text-sm font-bold tabular-nums ${countdownColor}`}>
                {String(Math.floor(countdown / 60)).padStart(2, "0")}:
                {String(countdown % 60).padStart(2, "0")}
              </p>
            </div>

            {/* Token teks (fallback kalau kamera tidak bisa scan) */}
            <div className="mt-5 rounded-xl border border-border-soft bg-surface-2 px-4 py-3 text-center">
              <p className="text-xs text-text-tertiary mb-1">Kode manual (jika kamera bermasalah)</p>
              <p className="font-display text-xl font-extrabold tracking-widest text-text-primary">
                {qr.token.slice(0, 4)}-{qr.token.slice(4, 8)}-{qr.token.slice(8, 12)}-{qr.token.slice(12)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Instruksi singkat */}
      <div className="mt-8 max-w-sm space-y-2 text-center">
        <p className="text-xs text-text-tertiary">
          Barber buka dashboard → tap <strong>Absen Masuk</strong> atau <strong>Absen Pulang</strong> → scan QR ini.
        </p>
        <p className="text-xs text-text-tertiary">
          QR otomatis berubah tiap 5 menit. Tidak bisa dipakai dari luar barbershop.
        </p>
      </div>
    </div>
  );
}

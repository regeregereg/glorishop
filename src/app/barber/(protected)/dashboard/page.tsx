"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import jsQR from "jsqr";
import { Booking, Service } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatTime, formatRupiah, getBookingServiceNames, getBookingPriceLabel, toLocalDateString } from "@/lib/utils";
import { getBookingTotalCommission } from "@/lib/commission";
import { Play, Check, Star, Plus, X, Scissors, Wallet, AlertCircle, LogIn, LogOut, Clock, ScanLine, QrCode, CheckCircle2 } from "lucide-react";

// ─── Tipe absensi ────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string;
  staff_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  note: string | null;
}

// ─── Helper: format jam WIB dari ISO string ───────────────────────────────────
function formatJam(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

// ─── Modal Scan QR ───────────────────────────────────────────────────────────
function QrScanModal({
  action,
  onClose,
  onSuccess,
}: {
  action: "clock_in" | "clock_out";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode]           = useState<"camera" | "manual">("camera");
  const [token, setToken]         = useState("");
  const [submitting, setSub]      = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [scanning, setScanning]   = useState(false);
  const videoRef                  = useRef<HTMLVideoElement>(null);
  const canvasRef                 = useRef<HTMLCanvasElement>(null);
  const streamRef                 = useRef<MediaStream | null>(null);
  const rafRef                    = useRef<number | null>(null);

  // Submit token ke API
  async function submitToken(raw: string) {
    if (submitting) return;
    const cleaned = raw.replace(/GLORI-ABSEN:/i, "").replace(/-/g, "").trim().toUpperCase();
    if (!cleaned) { setError("Token tidak valid."); return; }
    setSub(true);
    setError("");
    stopCamera();

    // ─── Ambil GPS sebelum kirim ke server ───────────────────────────────────
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error("no-geo")); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (geoErr: unknown) {
      const err = geoErr as { code?: number; message?: string };
      // code 1 = izin ditolak user
      if (err?.code === 1) {
        setError("Izin lokasi ditolak. Aktifkan GPS di pengaturan browser untuk bisa absen.");
        setSub(false);
        return;
      }
      // code 2/3 = tidak dapat sinyal — tetap kirim tanpa koordinat,
      // server yang memutuskan apakah GPS wajib atau tidak.
    }

    try {
      const res = await fetch("/api/attendance-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleaned, action, lat, lng }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Gagal absen."); setSub(false); return; }
      setSuccess(d.message || "Berhasil!");
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch {
      setError("Gagal terhubung. Periksa koneksi internet.");
      setSub(false);
    }
  }

  // Hentikan kamera
  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  // Mulai kamera (jsQR sudah di-bundle, tidak perlu load CDN)
  async function startCamera() {
    setError("");

    // Minta izin kamera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      scanLoop();
    } catch {
      // Izin kamera ditolak atau tidak tersedia — langsung ke mode manual
      stopCamera();
      setMode("manual");
      setError("Izin kamera ditolak. Gunakan kode manual yang tampil di layar kasir.");
    }
  }

  // Loop scan frame
  function scanLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function tick() {
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas!.width  = video.videoWidth;
      canvas!.height = video.videoHeight;
      ctx!.drawImage(video, 0, 0);
      const imageData = ctx!.getImageData(0, 0, canvas!.width, canvas!.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        submitToken(code.data);
        return; // stop loop setelah berhasil scan
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  // Auto-start kamera saat modal buka
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch mode
  function switchToManual() {
    stopCamera();
    setMode("manual");
  }
  function switchToCamera() {
    setToken("");
    setError("");
    setMode("camera");
    startCamera();
  }

  const label = action === "clock_in" ? "Absen Masuk" : "Absen Pulang";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-border-soft bg-surface p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-accent" />
            <h2 className="font-display text-lg font-bold">{label}</h2>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Tab mode */}
        {!success && (
          <div className="flex rounded-xl border border-border-soft bg-surface-2 p-1 mb-4 gap-1">
            <button
              onClick={switchToCamera}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "camera" ? "bg-surface text-text-primary shadow-sm" : "text-text-tertiary"
              }`}
            >
              <ScanLine size={13} /> Scan QR
            </button>
            <button
              onClick={switchToManual}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                mode === "manual" ? "bg-surface text-text-primary shadow-sm" : "text-text-tertiary"
              }`}
            >
              <QrCode size={13} /> Kode Manual
            </button>
          </div>
        )}

        {/* Sukses */}
        {success && (
          <div className="flex flex-col items-center gap-2 py-6">
            <CheckCircle2 size={40} className="text-status-done" />
            <p className="font-display text-base font-bold text-status-done">{success}</p>
          </div>
        )}

        {/* Mode kamera */}
        {!success && mode === "camera" && (
          <div>
            {/* Viewfinder */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square w-full mb-3">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              {/* Target overlay */}
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 relative">
                    {/* Corner brackets */}
                    <span className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                    <span className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent rounded-br-lg" />
                    {/* Scan line animasi */}
                    <span className="absolute left-2 right-2 h-0.5 bg-accent/70 animate-bounce top-1/2" />
                  </div>
                </div>
              )}
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
                </div>
              )}
              {/* Canvas tersembunyi untuk decode */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <p className="text-center text-xs text-text-tertiary mb-3">
              Arahkan kamera ke QR yang tampil di layar kasir
            </p>

            {/* Info GPS */}
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <span className="text-[10px] text-text-tertiary">📍 Lokasi GPS akan dicek saat absen</span>
            </div>

            {error && (
              <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled text-center mb-2">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Mode manual */}
        {!success && mode === "manual" && (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border-soft bg-surface-2 px-4 py-4 text-center">
              <p className="text-xs text-text-tertiary mb-1">Lihat kode di layar kasir</p>
              <p className="text-xs text-text-secondary">Ketik 6 karakter yang tampil di bawah QR</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                Kode manual (6 karakter)
              </label>
              <input
                autoFocus
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="Contoh: A3K9ZR"
                maxLength={6}
                className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-3 text-center text-2xl font-mono font-bold outline-none focus:border-accent tracking-[0.4em] uppercase"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
                {error}
              </p>
            )}

            <button
              disabled={submitting || token.length < 6}
              onClick={() => submitToken(token)}
              className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-black disabled:opacity-40 transition-opacity mt-1"
            >
              {submitting ? "Memverifikasi..." : `Konfirmasi ${label}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Widget Absensi (dengan QR flow) ─────────────────────────────────────────
function AttendanceWidget({ staffId }: { staffId: string }) {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading]       = useState(true);
  const [scanAction, setScanAction] = useState<"clock_in" | "clock_out" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance?staffId=${staffId}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setAttendance(d.attendance ?? null);
    } catch {
      // diam saja
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;

  const sudahMasuk  = !!attendance?.clock_in;
  const sudahPulang = !!attendance?.clock_out;

  return (
    <>
      <div className="mt-4 rounded-2xl border border-border-soft bg-surface overflow-hidden">
        {/* Header info */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent shrink-0">
            <Clock size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-secondary">Absensi Hari Ini</p>
            <div className="mt-0.5 flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs font-semibold text-text-primary">
                <LogIn size={11} className={sudahMasuk ? "text-status-done" : "text-text-tertiary"} />
                {sudahMasuk ? formatJam(attendance?.clock_in) : "Belum masuk"}
              </span>
              <span className="text-text-tertiary">·</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-text-primary">
                <LogOut size={11} className={sudahPulang ? "text-status-cancelled" : "text-text-tertiary"} />
                {sudahPulang ? formatJam(attendance?.clock_out) : "Belum pulang"}
              </span>
            </div>
          </div>

          {!sudahMasuk && (
            <span className="shrink-0 rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-semibold text-yellow-600">
              Belum Absen
            </span>
          )}
          {sudahMasuk && !sudahPulang && (
            <span className="shrink-0 rounded-full bg-status-done/15 px-2.5 py-1 text-xs font-semibold text-status-done">
              Sudah Masuk
            </span>
          )}
          {sudahPulang && (
            <span className="shrink-0 rounded-full bg-border-soft px-2.5 py-1 text-xs font-semibold text-text-secondary">
              Selesai
            </span>
          )}
        </div>

        {/* Tombol scan QR */}
        {!sudahPulang && (
          <div className="px-4 pb-4">
            {!sudahMasuk && (
              <Button
                fullWidth
                icon={<ScanLine size={16} />}
                onClick={() => setScanAction("clock_in")}
              >
                Scan QR — Absen Masuk
              </Button>
            )}
            {sudahMasuk && !sudahPulang && (
              <Button
                fullWidth
                variant="secondary"
                icon={<ScanLine size={16} />}
                onClick={() => setScanAction("clock_out")}
              >
                Scan QR — Absen Pulang
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modal scan */}
      {scanAction && (
        <QrScanModal
          action={scanAction}
          onClose={() => setScanAction(null)}
          onSuccess={load}
        />
      )}
    </>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────
export default function BarberDashboardPage() {
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmDoneId, setConfirmDoneId] = useState<string | null>(null);
  const [showWalkinForm, setShowWalkinForm] = useState(false);

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

  const todayCommission = bookings
    .filter((b) => ["CONFIRMED", "IN_PROGRESS", "DONE"].includes(b.status))
    .reduce((sum, b) => sum + getBookingTotalCommission(b), 0);

  const bookingTerlupakan = queue.filter((b) => {
    if (b.status !== "IN_PROGRESS" || !b.slot?.date || !b.slot?.start_time) return false;
    const slotStart = new Date(`${b.slot?.date ?? ""}T${b.slot?.start_time ?? ""}`);
    return Date.now() - slotStart.getTime() > 45 * 60 * 1000;
  });

  return (
    <div className="px-5 pt-6">
      {bookingTerlupakan.length > 0 && (
        <div className="mb-5 rounded-2xl border border-status-progress/40 bg-status-progress/10 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-status-progress" />
            <p className="text-sm font-bold text-status-progress">
              Jangan lupa tandai selesai!
            </p>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {bookingTerlupakan.map((b) => b.user?.name ?? b.walkin_name ?? "Pelanggan").join(", ")} sudah selesai lebih dari 45 menit. Scroll ke bawah dan klik &ldquo;Selesai&rdquo;.
          </p>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Hai, {staffName.split(" ")[0] || "Barber"} 👋</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Antrian klien kamu hari ini.
          </p>
        </div>
        <Button
          size="sm"
          icon={<Plus size={15} />}
          onClick={() => setShowWalkinForm(true)}
          className="shrink-0"
        >
          Cukur Langsung
        </Button>
      </div>

      {/* Widget Absensi — muncul begitu staffId tersedia */}
      {staffId && <AttendanceWidget staffId={staffId} />}

      {!loading && !sessionError && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Wallet size={16} />
          </div>
          <div>
            <p className="text-xs text-text-secondary">Estimasi komisi hari ini</p>
            <p className="font-display text-base font-bold text-accent">{formatRupiah(todayCommission)}</p>
          </div>
        </div>
      )}

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
                  {b.walkin_by_barber && " • Walk-in"}
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
                confirmDoneId === b.id ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-center text-xs font-semibold text-text-primary">
                      Tandai pekerjaan ini selesai?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        fullWidth
                        variant="ghost"
                        onClick={() => setConfirmDoneId(null)}
                      >
                        Batal
                      </Button>
                      <Button
                        size="sm"
                        fullWidth
                        icon={<Check size={15} />}
                        onClick={() => { setConfirmDoneId(null); updateStatus(b.id, "DONE"); }}
                        disabled={actingId === b.id}
                      >
                        Ya, Selesai
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    fullWidth
                    variant="secondary"
                    icon={<Check size={18} />}
                    onClick={() => setConfirmDoneId(b.id)}
                    disabled={actingId === b.id}
                  >
                    Selesai
                  </Button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-text-tertiary">
        <Star size={14} className="fill-accent text-accent" />
        Lihat riwayat dan rating kamu di tab Riwayat
      </div>

      {showWalkinForm && staffId && (
        <WalkinForm
          barberId={staffId}
          onClose={() => setShowWalkinForm(false)}
          onCreated={() => loadQueue(true)}
        />
      )}
    </div>
  );
}

// ─── Form Walk-in (tidak diubah) ──────────────────────────────────────────────
function WalkinForm({
  barberId,
  onClose,
  onCreated,
}: {
  barberId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [finalPrices, setFinalPrices] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => {
        const eligible = (d.services || []).filter(
          (s: Service) => !s.is_home_service_only && s.category !== "home_service"
        );
        setServices(eligible);
      })
      .finally(() => setServicesLoading(false));
  }, []);

  function toggleService(s: Service) {
    setServiceIds((prev) =>
      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
    );
  }

  const selectedServiceObjs = serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is Service => !!s);
  const rangeServices = selectedServiceObjs.filter((s) => s.price_min != null && s.price_max != null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (serviceIds.length === 0) {
      setError("Pilih minimal satu layanan.");
      return;
    }
    for (const s of rangeServices) {
      if (!finalPrices[s.id]) {
        setError(`Isi harga final untuk "${s.name}" (layanan dengan range harga).`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barber_id: barberId,
          service_ids: serviceIds,
          walkin_name: name || undefined,
          walkin_phone: phone || undefined,
          final_prices: Object.fromEntries(
            Object.entries(finalPrices).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mencatat cukuran.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Terjadi kesalahan. Periksa koneksi internet kamu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-border-soft bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors size={18} className="text-accent" />
            <h2 className="font-display text-lg font-bold">Cukur Langsung</h2>
          </div>
          <button onClick={onClose} className="text-text-secondary">
            <X size={20} />
          </button>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Untuk pelanggan yang datang langsung tanpa booking. Otomatis tercatat ke admin.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            placeholder="Nama pelanggan (opsional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            placeholder="Nomor telepon (opsional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />

          <div>
            <p className="mb-1.5 text-xs font-semibold text-text-secondary">
              Layanan (boleh pilih lebih dari satu)
            </p>
            <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-border-soft bg-surface-2 p-2">
              {servicesLoading && (
                <p className="px-2 py-2 text-xs text-text-tertiary">Memuat layanan...</p>
              )}
              {!servicesLoading && services.map((s) => {
                const checked = serviceIds.includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleService(s)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      checked ? "bg-accent/15 text-text-primary" : "text-text-secondary hover:bg-surface"
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                        checked ? "border-accent bg-accent text-black" : "border-border-soft"
                      }`}
                    >
                      {checked && <Check size={10} strokeWidth={3} />}
                    </div>
                    {s.name}
                  </button>
                );
              })}
              {!servicesLoading && services.length === 0 && (
                <p className="px-2 py-2 text-xs text-text-tertiary">Belum ada layanan tersedia.</p>
              )}
            </div>
          </div>

          {rangeServices.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-text-secondary">
                Harga final (layanan dengan range harga)
              </p>
              {rangeServices.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-text-secondary">{s.name}</span>
                  <input
                    type="number"
                    placeholder={`${s.price_min}-${s.price_max}`}
                    value={finalPrices[s.id] ?? ""}
                    onChange={(e) => setFinalPrices((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className="w-32 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">
              {error}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting} className="mt-1">
            {submitting ? "Menyimpan..." : "Catat & Selesai"}
          </Button>
        </form>
      </div>
    </div>
  );
}

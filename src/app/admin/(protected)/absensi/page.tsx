"use client";

import { useEffect, useState, useCallback } from "react";
import { ErrorState } from "@/components/ErrorState";
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, Users, CheckCircle2, XCircle, QrCode } from "lucide-react";
import { Button } from "@/components/Button";
import Link from "next/link";

// ─── Widget absen diri sendiri (admin) ───────────────────────────────────────
interface SelfAttendance {
  id: string;
  clock_in: string | null;
  clock_out: string | null;
}

function AdminSelfAttendanceWidget({ onAbsen }: { onAbsen: () => void }) {
  const [att, setAtt]         = useState<SelfAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [error, setError]     = useState("");
  const [flash, setFlash]     = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance");
      if (!res.ok) return;
      const d = await res.json();
      setAtt(d.attendance ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAbsen(action: "clock_in" | "clock_out") {
    // Ambil GPS dulu sebelum kirim ke server
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error("no-geo")); return; }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (geoErr: unknown) {
      const err = geoErr as { code?: number };
      if (err?.code === 1) {
        setError("Izin lokasi ditolak. Aktifkan GPS di pengaturan browser untuk bisa absen.");
        return;
      }
    }
    setActing(true);
    setError("");
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lat, lng }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Gagal absen."); return; }
      setFlash(action === "clock_in" ? "Absen masuk berhasil!" : "Absen pulang berhasil!");
      setTimeout(() => setFlash(""), 3000);
      await load();
      onAbsen(); // refresh tabel staff
    } finally {
      setActing(false);
    }
  }

  const sudahMasuk  = !!att?.clock_in;
  const sudahPulang = !!att?.clock_out;

  if (loading) return null;

  return (
    <div className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <p className="text-xs font-bold text-accent mb-3 uppercase tracking-wide">Absensi Saya (Admin)</p>

      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          <LogIn size={12} className={sudahMasuk ? "text-status-done" : "text-text-tertiary"} />
          <span className={sudahMasuk ? "font-semibold text-text-primary" : "text-text-tertiary"}>
            {att?.clock_in
              ? new Date(att.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
              : "--:--"}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-text-secondary">
          <LogOut size={12} className={sudahPulang ? "text-status-cancelled" : "text-text-tertiary"} />
          <span className={sudahPulang ? "font-semibold text-text-primary" : "text-text-tertiary"}>
            {att?.clock_out
              ? new Date(att.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
              : "--:--"}
          </span>
        </span>
        {sudahMasuk && !sudahPulang && (
          <span className="rounded-full bg-status-done/15 px-2 py-0.5 text-[10px] font-bold text-status-done">HADIR</span>
        )}
        {sudahPulang && (
          <span className="rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold text-text-secondary">SELESAI</span>
        )}
        {!sudahMasuk && (
          <span className="rounded-full bg-status-cancelled/15 px-2 py-0.5 text-[10px] font-bold text-status-cancelled">BELUM MASUK</span>
        )}
      </div>

      {flash && (
        <p className="mb-2 rounded-xl bg-status-done/10 px-3 py-2 text-xs font-semibold text-status-done">{flash}</p>
      )}
      {error && (
        <p className="mb-2 rounded-xl bg-status-cancelled/10 px-3 py-2 text-xs text-status-cancelled">{error}</p>
      )}

      <div className="flex gap-2">
        {!sudahMasuk && (
          <Button
            size="sm"
            icon={<LogIn size={13} />}
            disabled={acting}
            onClick={() => handleAbsen("clock_in")}
          >
            {acting ? "..." : "Absen Masuk"}
          </Button>
        )}
        {sudahMasuk && !sudahPulang && (
          <Button
            size="sm"
            variant="ghost"
            icon={<LogOut size={13} />}
            disabled={acting}
            onClick={() => handleAbsen("clock_out")}
          >
            {acting ? "..." : "Absen Pulang"}
          </Button>
        )}
        {sudahPulang && (
          <p className="text-xs text-text-tertiary py-1">Absensi hari ini selesai.</p>
        )}
      </div>
    </div>
  );
}

interface StaffAttendance {
  id: string;
  name: string;
  role: "admin" | "barber";
  photo_url: string | null;
  attendance: {
    id: string;
    clock_in: string | null;
    clock_out: string | null;
    note: string | null;
  } | null;
}

function formatJam(iso: string | null | undefined): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function durasiKerja(clockIn: string | null, clockOut: string | null): string {
  if (!clockIn) return "-";
  const start = new Date(clockIn).getTime();
  const end   = clockOut ? new Date(clockOut).getTime() : Date.now();
  const menit = Math.floor((end - start) / 60000);
  const jam   = Math.floor(menit / 60);
  const sisa  = menit % 60;
  if (jam === 0) return `${sisa}m`;
  return `${jam}j ${sisa}m`;
}

function formatTanggal(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AdminAbsensiPage() {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [staff, setStaff]               = useState<StaffAttendance[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editNote, setEditNote]         = useState("");
  const [saving, setSaving]             = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/daily?date=${selectedDate}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setStaff(d.staff ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  function geserHari(delta: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
  }

  async function saveNote(attendanceId: string) {
    setSaving(true);
    try {
      await fetch("/api/attendance/daily", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, note: editNote }),
      });
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  // Ringkasan
  const sudahMasuk  = staff.filter((s) => s.attendance?.clock_in).length;
  const sudahPulang = staff.filter((s) => s.attendance?.clock_out).length;
  const belumAbsen  = staff.filter((s) => !s.attendance?.clock_in).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Absensi Staff</h1>
          <p className="mt-1 text-sm text-text-secondary">Rekap kehadiran barber dan admin.</p>
        </div>
        <Link href="/admin/absensi/qr">
          <Button size="sm" icon={<QrCode size={15} />} className="shrink-0">
            Tampilkan QR
          </Button>
        </Link>
      </div>

      {/* Widget absen diri sendiri — hanya tampil di hari ini */}
      {selectedDate === todayStr && (
        <AdminSelfAttendanceWidget onAbsen={load} />
      )}

      {/* Navigasi tanggal */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => geserHari(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft bg-surface text-text-secondary hover:bg-surface-2"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="font-display text-sm font-bold">{formatTanggal(selectedDate)}</p>
          {selectedDate === todayStr && (
            <p className="text-xs text-accent font-semibold">Hari Ini</p>
          )}
        </div>
        <button
          onClick={() => geserHari(1)}
          disabled={selectedDate >= todayStr}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-soft bg-surface text-text-secondary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
        {/* Tombol balik ke hari ini */}
        {selectedDate !== todayStr && (
          <button
            onClick={() => setSelectedDate(todayStr)}
            className="rounded-xl border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent"
          >
            Hari Ini
          </button>
        )}
      </div>

      {/* Ringkasan stats */}
      {!loading && !loadError && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border-soft bg-surface p-3 text-center">
            <div className="flex justify-center mb-1">
              <Users size={16} className="text-text-secondary" />
            </div>
            <p className="font-display text-xl font-extrabold">{staff.length}</p>
            <p className="text-xs text-text-secondary">Total Staff</p>
          </div>
          <div className="rounded-2xl border border-border-soft bg-surface p-3 text-center">
            <div className="flex justify-center mb-1">
              <CheckCircle2 size={16} className="text-status-done" />
            </div>
            <p className="font-display text-xl font-extrabold text-status-done">{sudahMasuk}</p>
            <p className="text-xs text-text-secondary">Sudah Masuk</p>
          </div>
          <div className="rounded-2xl border border-border-soft bg-surface p-3 text-center">
            <div className="flex justify-center mb-1">
              <XCircle size={16} className="text-status-cancelled" />
            </div>
            <p className="font-display text-xl font-extrabold text-status-cancelled">{belumAbsen}</p>
            <p className="text-xs text-text-secondary">Belum Masuk</p>
          </div>
        </div>
      )}

      {/* List staff */}
      <div className="mt-4 flex flex-col gap-3">
        {loading && (
          <p className="py-10 text-center text-sm text-text-secondary">Memuat...</p>
        )}
        {!loading && loadError && (
          <ErrorState
            title="Gagal memuat absensi"
            message="Periksa koneksi internet, lalu coba lagi."
            onRetry={load}
          />
        )}
        {!loading && !loadError && staff.map((s) => {
          const att         = s.attendance;
          const sudahMasukS = !!att?.clock_in;
          const sudahPulangS = !!att?.clock_out;
          const isEditing   = editingId === att?.id;

          return (
            <div
              key={s.id}
              className="rounded-2xl border border-border-soft bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-accent-soft flex items-center justify-center text-accent font-bold text-sm">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    s.name.charAt(0).toUpperCase()
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-display font-bold text-sm truncate">{s.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      s.role === "admin"
                        ? "bg-accent/15 text-accent"
                        : "bg-border-soft text-text-secondary"
                    }`}>
                      {s.role}
                    </span>
                  </div>

                  {/* Jam masuk & pulang */}
                  <div className="mt-1.5 flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                      <LogIn size={11} className={sudahMasukS ? "text-status-done" : "text-text-tertiary"} />
                      <span className={sudahMasukS ? "font-semibold text-text-primary" : "text-text-tertiary"}>
                        {formatJam(att?.clock_in)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-text-secondary">
                      <LogOut size={11} className={sudahPulangS ? "text-status-cancelled" : "text-text-tertiary"} />
                      <span className={sudahPulangS ? "font-semibold text-text-primary" : "text-text-tertiary"}>
                        {formatJam(att?.clock_out)}
                      </span>
                    </span>
                    {sudahMasukS && (
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <Clock size={10} />
                        {durasiKerja(att?.clock_in ?? null, att?.clock_out ?? null)}
                        {!sudahPulangS && selectedDate === todayStr && " (masih kerja)"}
                      </span>
                    )}
                  </div>

                  {/* Note */}
                  {att?.note && !isEditing && (
                    <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-text-secondary">
                      📝 {att.note}
                    </p>
                  )}
                </div>

                {/* Badge status & tombol edit note */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {!sudahMasukS && (
                    <span className="rounded-full bg-status-cancelled/15 px-2 py-0.5 text-[10px] font-bold text-status-cancelled">
                      TIDAK MASUK
                    </span>
                  )}
                  {sudahMasukS && !sudahPulangS && (
                    <span className="rounded-full bg-status-done/15 px-2 py-0.5 text-[10px] font-bold text-status-done">
                      HADIR
                    </span>
                  )}
                  {sudahPulangS && (
                    <span className="rounded-full bg-border-soft px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                      SELESAI
                    </span>
                  )}

                  {att && !isEditing && (
                    <button
                      onClick={() => { setEditingId(att.id); setEditNote(att.note ?? ""); }}
                      className="text-xs text-text-tertiary hover:text-text-secondary underline"
                    >
                      + Catatan
                    </button>
                  )}
                </div>
              </div>

              {/* Form edit note (inline) */}
              {isEditing && (
                <div className="mt-3 flex gap-2">
                  <input
                    autoFocus
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Catatan (izin, sakit, dsb)"
                    className="flex-1 rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <Button size="sm" onClick={() => saveNote(att!.id)} disabled={saving}>
                    {saving ? "..." : "Simpan"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Batal
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {!loading && !loadError && staff.length === 0 && (
          <div className="rounded-2xl border border-border-soft bg-surface px-6 py-12 text-center">
            <p className="font-display text-sm font-semibold">Tidak ada staff aktif</p>
          </div>
        )}
      </div>

      {/* Keterangan auto-close */}
      <p className="mt-6 text-xs text-text-tertiary text-center">
        Absensi yang belum ditutup akan otomatis ditutup pukul 23:59 WIB.
      </p>
    </div>
  );
}

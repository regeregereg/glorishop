"use client";

import { useEffect, useState, useCallback } from "react";
import { ErrorState } from "@/components/ErrorState";
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, Users, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/Button";

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
      <h1 className="font-display text-2xl font-extrabold">Absensi Staff</h1>
      <p className="mt-1 text-sm text-text-secondary">Rekap kehadiran barber dan admin.</p>

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

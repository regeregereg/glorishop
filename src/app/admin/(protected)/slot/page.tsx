"use client";

import { useEffect, useState, useCallback } from "react";
import { Staff, Slot } from "@/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { formatTime } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  CalendarCheck,
  Clock,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipe ────────────────────────────────────────────────────────────────────

type DayStatus = "open" | "full" | "empty";
type Summary = Record<string, DayStatus>; // "YYYY-MM-DD" → status

interface DayDetail {
  date: string;      // YYYY-MM-DD
  slots: Slot[];
  loading: boolean;
  error: boolean;
}

// ─── Konstanta ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0 = Minggu
}

function generateTimeRanges(
  startTime: string,
  endTime: string,
  intervalMin: number,
  breakStart?: string,
  breakEnd?: string
) {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const ranges: { start_time: string; end_time: string }[] = [];
  let cur = toMin(startTime);
  const end = toMin(endTime);
  const breakStartMin = breakStart ? toMin(breakStart) : null;
  const breakEndMin = breakEnd ? toMin(breakEnd) : null;
  while (cur + intervalMin <= end) {
    const slotEnd = cur + intervalMin;
    const overlapsBreak =
      breakStartMin !== null && breakEndMin !== null && cur < breakEndMin && slotEnd > breakStartMin;
    if (!overlapsBreak) {
      const s = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`;
      const e = `${pad(Math.floor(slotEnd / 60))}:${pad(slotEnd % 60)}`;
      ranges.push({ start_time: s, end_time: e });
    }
    cur += intervalMin;
  }
  return ranges;
}

// ─── Status badge warna ───────────────────────────────────────────────────────

const DAY_STYLE: Record<DayStatus, string> = {
  open:  "bg-status-done/15 text-status-done border-status-done/30",
  full:  "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/25",
  empty: "bg-surface-2 text-text-tertiary border-border-soft",
};

const DAY_STYLE_SELECTED: Record<DayStatus, string> = {
  open:  "ring-2 ring-status-done",
  full:  "ring-2 ring-status-cancelled",
  empty: "ring-2 ring-accent",
};

// ─── Komponen utama ───────────────────────────────────────────────────────────

export default function AdminSlotPage() {
  // Barber
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [barberId, setBarberId] = useState("");
  const [barbersError, setBarbersError] = useState(false);

  // Kalender
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1-based
  const [summary, setSummary] = useState<Summary>({});
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Seleksi hari
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // Panel kanan: detail hari yang diklik tunggal
  const [detail, setDetail] = useState<DayDetail | null>(null);

  // Konfigurasi slot
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [intervalMin, setIntervalMin] = useState(30);
  // Jam istirahat barber yang dipilih (dari staff.break_start/break_end,
  // diatur di halaman Kelola Barber) — dipakai untuk otomatis melubangi
  // slot saat generate. Toggle ini biar admin bisa matikan sementara untuk
  // 1 batch tertentu (mis. hari libur nasional yang jam kerjanya beda)
  // tanpa perlu hapus setting jam istirahat permanen si barber.
  const [excludeBreak, setExcludeBreak] = useState(true);

  // Aksi hapus slot jam istirahat yang kadung ke-generate sebelumnya
  const [clearingBreak, setClearingBreak] = useState(false);

  // State aksi
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Mode: "single" (klik satu hari) atau "multi" (shift/check banyak hari)
  const [multiMode, setMultiMode] = useState(false);

  // ── Load barber ─────────────────────────────────────────────────────────────
  function loadBarbers() {
    setBarbersError(false);
    fetch("/api/barbers")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => {
        setBarbers(d.barbers ?? []);
        if (d.barbers?.[0]) setBarberId(d.barbers[0].id);
      })
      .catch(() => setBarbersError(true));
  }

  useEffect(() => { loadBarbers(); }, []);

  // Barber yang lagi dipilih + jam istirahatnya (kalau sudah diatur di
  // Kelola Barber). "HH:MM:SS" dari Postgres dipotong ke "HH:MM".
  const selectedBarber = barbers.find((b) => b.id === barberId) ?? null;
  const barberBreakStart = selectedBarber?.break_start?.slice(0, 5) || null;
  const barberBreakEnd = selectedBarber?.break_end?.slice(0, 5) || null;
  const hasBarberBreak = !!(barberBreakStart && barberBreakEnd);
  const activeBreakStart = excludeBreak && hasBarberBreak ? barberBreakStart! : undefined;
  const activeBreakEnd = excludeBreak && hasBarberBreak ? barberBreakEnd! : undefined;

  // ── Load summary bulanan ────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    if (!barberId) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(
        `/api/slots/summary?barberId=${barberId}&year=${viewYear}&month=${viewMonth}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary ?? {});
    } catch {
      setSummary({});
    } finally {
      setSummaryLoading(false);
    }
  }, [barberId, viewYear, viewMonth]);

  useEffect(() => {
    setSelectedDates(new Set());
    setDetail(null);
    loadSummary();
  }, [loadSummary]);

  // ── Load detail slot satu hari ──────────────────────────────────────────────
  async function loadDayDetail(date: string) {
    setDetail({ date, slots: [], loading: true, error: false });
    try {
      const res = await fetch(`/api/slots?barberId=${barberId}&date=${date}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const slots = (data.slots ?? []).sort((a: Slot, b: Slot) =>
        a.start_time.localeCompare(b.start_time)
      );
      setDetail({ date, slots, loading: false, error: false });
    } catch {
      setDetail((prev) => prev ? { ...prev, loading: false, error: true } : null);
    }
  }

  // ── Toast helper ────────────────────────────────────────────────────────────
  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Klik hari di kalender ───────────────────────────────────────────────────
  function handleDayClick(date: string) {
    if (multiMode) {
      // Toggle dalam set pilihan
      setSelectedDates((prev) => {
        const next = new Set(prev);
        if (next.has(date)) next.delete(date);
        else next.add(date);
        return next;
      });
      setDetail(null);
    } else {
      // Mode tunggal: tampilkan detail
      setSelectedDates(new Set([date]));
      loadDayDetail(date);
    }
  }

  // ── Generate slot ───────────────────────────────────────────────────────────
  async function handleGenerate() {
    const dates = Array.from(selectedDates).sort();
    if (!barberId || dates.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/slots/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barber_id: barberId,
          dates,
          start_time: startTime,
          end_time: endTime,
          interval_min: intervalMin,
          break_start: activeBreakStart,
          break_end: activeBreakEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const slotsPerDay = generateTimeRanges(startTime, endTime, intervalMin, activeBreakStart, activeBreakEnd).length;
      showToast(
        `✓ ${dates.length} hari berhasil dibuka — ${slotsPerDay} slot per hari`,
        true
      );
      await loadSummary();
      // Refresh detail kalau sedang lihat salah satu tanggal yang baru digenerate
      if (!multiMode && detail && dates.includes(detail.date)) {
        loadDayDetail(detail.date);
      }
    } catch (err: unknown) {
      showToast((err as Error).message || "Gagal generate slot.", false);
    } finally {
      setGenerating(false);
    }
  }

  // ── Hapus slot jam istirahat (retroaktif) ───────────────────────────────────
  async function handleClearBreak(date: string) {
    if (!barberId || !barberBreakStart || !barberBreakEnd) return;
    setClearingBreak(true);
    try {
      const res = await fetch("/api/slots/clear-break", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barber_id: barberId,
          date,
          break_start: barberBreakStart,
          break_end: barberBreakEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.bookedCount > 0) {
        showToast(
          `${data.deletedCount} slot kosong dihapus. ${data.bookedCount} sudah dibooking — hubungi pelanggan untuk reschedule.`,
          true
        );
      } else {
        showToast(`${data.deletedCount} slot di jam istirahat dihapus.`, true);
      }
      loadDayDetail(date);
      await loadSummary();
    } catch (err: unknown) {
      showToast((err as Error).message || "Gagal membersihkan slot istirahat.", false);
    } finally {
      setClearingBreak(false);
    }
  }

  // ── Hapus slot satu hari ────────────────────────────────────────────────────
  async function handleDeleteDay(date: string) {
    if (!barberId) return;
    if (!confirm(`Hapus semua slot ${date}? Slot yang sudah dibooking tidak akan terhapus.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/slots/delete-day", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barber_id: barberId, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Slot ${date} dihapus.`, true);
      setDetail(null);
      setSelectedDates((prev) => { const n = new Set(prev); n.delete(date); return n; });
      await loadSummary();
    } catch (err: unknown) {
      showToast((err as Error).message || "Gagal hapus slot.", false);
    } finally {
      setDeleting(false);
    }
  }

  // ── Navigasi bulan ──────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1); }
    else setViewMonth((m) => m + 1);
  }

  // ── Kalender grid ───────────────────────────────────────────────────────────
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startOffset = firstWeekday(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const previewSlotCount = generateTimeRanges(startTime, endTime, intervalMin, activeBreakStart, activeBreakEnd).length;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-extrabold">Kelola Slot</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Buka hari kerja barber secara massal — pilih tanggal di kalender, atur jam, lalu generate.
        </p>
      </div>

      {barbersError && (
        <ErrorState
          title="Gagal memuat daftar barber"
          message="Periksa koneksi internet kamu, lalu coba lagi."
          onRetry={loadBarbers}
        />
      )}

      {!barbersError && (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">

          {/* ── KOLOM KIRI: Kalender ── */}
          <div className="space-y-4">

            {/* Pilih barber + toggle multi-select */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={barberId}
                onChange={(e) => { setBarberId(e.target.value); setSelectedDates(new Set()); setDetail(null); }}
                className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent min-w-[180px]"
              >
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <button
                onClick={() => { setMultiMode((v) => !v); setSelectedDates(new Set()); setDetail(null); }}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  multiMode
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border-soft bg-surface-2 text-text-secondary"
                )}
              >
                <CalendarCheck size={15} />
                {multiMode ? "Mode multi aktif" : "Pilih banyak hari"}
              </button>

              {multiMode && selectedDates.size > 0 && (
                <span className="text-sm text-text-secondary">
                  {selectedDates.size} hari dipilih
                </span>
              )}

              <button
                onClick={loadSummary}
                disabled={summaryLoading}
                aria-label="Refresh kalender"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-border-soft bg-surface text-text-secondary hover:bg-surface-2"
              >
                <RefreshCw size={14} className={summaryLoading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Card kalender */}
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">

              {/* Navigasi bulan */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft text-text-secondary hover:bg-surface-2">
                  <ChevronLeft size={16} />
                </button>
                <h2 className="font-display text-base font-bold">
                  {MONTH_NAMES[viewMonth - 1]} {viewYear}
                </h2>
                <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft text-text-secondary hover:bg-surface-2">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Header hari */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((d) => (
                  <div key={d} className={cn(
                    "py-1 text-center text-[11px] font-bold text-text-tertiary",
                    d === "Min" && "text-status-cancelled/70"
                  )}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid hari */}
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const date = isoDate(viewYear, viewMonth, day);
                  const status = summary[date] ?? "empty";
                  const isSelected = selectedDates.has(date);
                  const isToday = date === TODAY;
                  const isPast = date < TODAY;

                  return (
                    <button
                      key={date}
                      onClick={() => handleDayClick(date)}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-xl border py-2 text-sm font-semibold transition-all aspect-square",
                        DAY_STYLE[status],
                        isSelected && DAY_STYLE_SELECTED[status],
                        isPast && "opacity-40",
                        isToday && "font-extrabold underline underline-offset-2",
                        (i % 7 === 0) && "text-status-cancelled" // Minggu
                      )}
                    >
                      {day}
                      {/* Status dot */}
                      {status !== "empty" && (
                        <span className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          status === "open" ? "bg-status-done" : "bg-status-cancelled"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center gap-4 text-[11px] text-text-tertiary">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-status-done/60" /> Ada slot
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-status-cancelled/60" /> Penuh
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-border-soft" /> Belum ada slot
                </span>
              </div>
            </div>
          </div>

          {/* ── KOLOM KANAN: Panel aksi ── */}
          <div className="space-y-4">

            {/* Konfigurasi jam */}
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 space-y-4">
              <h2 className="font-display text-sm font-bold flex items-center gap-2">
                <Clock size={15} /> Konfigurasi Jam Kerja
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Jam mulai</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-secondary">Jam selesai</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-text-secondary">Durasi per slot</label>
                <select
                  value={intervalMin}
                  onChange={(e) => setIntervalMin(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {[15, 20, 30, 45, 60].map((m) => (
                    <option key={m} value={m}>{m} menit</option>
                  ))}
                </select>
              </div>

              {/* Preview */}
              <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">
                {previewSlotCount} slot per hari · {startTime} – {endTime}
              </p>

              {/* Jam istirahat barber — dari Kelola Barber. Kalau belum
                  diatur untuk barber ini, tampilkan ajakan singkat saja
                  tanpa mengganggu alur generate yang sudah ada. */}
              {hasBarberBreak ? (
                <label className="flex items-center gap-2.5 rounded-xl border border-border-soft bg-surface-2 px-3 py-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeBreak}
                    onChange={(e) => setExcludeBreak(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-text-secondary">
                    Lewati jam istirahat{" "}
                    <span className="font-semibold text-text-primary">
                      {barberBreakStart}–{barberBreakEnd}
                    </span>{" "}
                    saat generate
                  </span>
                </label>
              ) : (
                <p className="rounded-xl border border-border-soft bg-surface-2 px-3 py-2 text-[11px] text-text-tertiary">
                  Barber ini belum punya jam istirahat. Atur di halaman{" "}
                  <span className="font-semibold">Kelola Barber</span> agar otomatis dilubangi di sini.
                </p>
              )}
            </div>

            {/* Aksi generate */}
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 space-y-3">
              <h2 className="font-display text-sm font-bold">
                {multiMode ? "Generate Banyak Hari" : "Aksi Hari Ini"}
              </h2>

              {selectedDates.size === 0 ? (
                <p className="text-sm text-text-secondary">
                  {multiMode
                    ? "Pilih satu atau lebih hari di kalender, lalu generate sekaligus."
                    : "Klik hari di kalender untuk melihat atau generate slot."}
                </p>
              ) : (
                <>
                  {/* Daftar hari terpilih (max tampil 5) */}
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(selectedDates).sort().slice(0, 6).map((d) => (
                      <span key={d} className="flex items-center gap-1 rounded-full border border-border-soft bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        {d.slice(5)} {/* MM-DD */}
                        <button
                          onClick={() => setSelectedDates((prev) => { const n = new Set(prev); n.delete(d); return n; })}
                          className="text-text-tertiary hover:text-text-primary"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {selectedDates.size > 6 && (
                      <span className="rounded-full border border-border-soft bg-surface-2 px-2.5 py-1 text-xs text-text-tertiary">
                        +{selectedDates.size - 6} lagi
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full"
                  >
                    {generating
                      ? "Membuat slot..."
                      : `Generate ${selectedDates.size} Hari`}
                  </Button>
                </>
              )}
            </div>

            {/* Detail hari (mode single) */}
            {!multiMode && detail && (
              <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-bold">
                    Slot {detail.date}
                  </h2>
                  {!detail.loading && !detail.error && detail.slots.length > 0 && (
                    <button
                      onClick={() => handleDeleteDay(detail.date)}
                      disabled={deleting}
                      className="flex items-center gap-1.5 rounded-full border border-status-cancelled/30 bg-status-cancelled/10 px-3 py-1.5 text-xs font-semibold text-status-cancelled hover:bg-status-cancelled/20"
                    >
                      <Trash2 size={12} />
                      {deleting ? "Menghapus..." : "Hapus semua"}
                    </button>
                  )}
                </div>

                {/* Bersihkan slot lama yang jatuh di jam istirahat — cuma
                    muncul kalau barber ini sudah punya jam istirahat
                    diatur DAN masih ada slot kosong di jam tersebut untuk
                    tanggal ini (biasanya slot lama dari sebelum jam
                    istirahat diatur). */}
                {!detail.loading && !detail.error && hasBarberBreak && barberBreakStart && barberBreakEnd &&
                  detail.slots.some(
                    (s) => s.is_available && s.start_time.slice(0, 5) >= barberBreakStart! && s.start_time.slice(0, 5) < barberBreakEnd!
                  ) && (
                    <button
                      onClick={() => handleClearBreak(detail.date)}
                      disabled={clearingBreak}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent hover:bg-accent-soft/70"
                    >
                      <Trash2 size={12} />
                      {clearingBreak
                        ? "Membersihkan..."
                        : `Bersihkan slot kosong di jam istirahat (${barberBreakStart}–${barberBreakEnd})`}
                    </button>
                  )}

                {detail.loading && (
                  <div className="flex flex-col gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-8 animate-pulse rounded-xl bg-surface-2" />
                    ))}
                  </div>
                )}

                {detail.error && (
                  <div className="flex items-center gap-2 text-sm text-status-cancelled">
                    <AlertCircle size={14} />
                    Gagal memuat slot.
                    <button onClick={() => loadDayDetail(detail.date)} className="underline text-xs">Coba lagi</button>
                  </div>
                )}

                {!detail.loading && !detail.error && detail.slots.length === 0 && (
                  <p className="text-sm text-text-secondary">
                    Belum ada slot. Generate sekarang?
                  </p>
                )}

                {!detail.loading && !detail.error && detail.slots.length > 0 && (
                  <>
                    <p className="text-xs text-text-tertiary">
                      {detail.slots.length} slot ·{" "}
                      {detail.slots.filter((s) => s.is_available).length} tersedia ·{" "}
                      {detail.slots.filter((s) => !s.is_available).length} terpakai
                    </p>
                    <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                      {detail.slots.map((s) => {
                        const inBreak =
                          hasBarberBreak &&
                          barberBreakStart &&
                          barberBreakEnd &&
                          s.start_time.slice(0, 5) >= barberBreakStart &&
                          s.start_time.slice(0, 5) < barberBreakEnd;
                        return (
                          <div
                            key={s.id}
                            className={cn(
                              "relative rounded-xl border px-2 py-2 text-center text-xs font-semibold",
                              s.is_available
                                ? "border-status-done/30 bg-status-done/10 text-status-done"
                                : "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled"
                            )}
                            title={
                              (s.is_available ? "Tersedia" : "Sudah dibooking") +
                              (inBreak ? " · jam istirahat" : "")
                            }
                          >
                            {inBreak && (
                              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-accent" />
                            )}
                            {formatTime(s.start_time)}
                            {s.is_available
                              ? <Check size={10} className="mx-auto mt-0.5 opacity-60" />
                              : <X size={10} className="mx-auto mt-0.5 opacity-60" />}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl transition-all",
            toast.ok
              ? "border-status-done/30 bg-surface text-status-done"
              : "border-status-cancelled/30 bg-surface text-status-cancelled"
          )}
        >
          {toast.ok ? <Check size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

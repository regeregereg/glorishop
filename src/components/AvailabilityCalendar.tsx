"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays, Clock3 } from "lucide-react";
import { Button } from "@/components/Button";
import { Slot } from "@/types";
import { cn, formatDateIndo, formatTime, toLocalDateString } from "@/lib/utils";

type DayStatus = "available" | "full" | "none";

// Kalender ketersediaan di Home — TUJUAN: jawab pertanyaan paling dasar
// untuk pelanggan awam ("tanggal ini masih ada slot kosong, tidak?")
// tanpa harus masuk ke flow booking penuh dulu. Semua barber digabung
// jadi satu status per tanggal, supaya orang yang belum kenal nama-nama
// barber tetap bisa langsung paham.
//
// Alur: pilih tanggal yang berstatus "available" -> list jam kosong
// (gabungan semua barber) muncul di bawah kalender -> pilih satu jam ->
// tombol "Booking" -> lanjut ke /booking dengan tanggal & jam ter-lock,
// pelanggan tinggal pilih layanan & barber di flow booking biasa.
export function AvailabilityCalendar() {
  const router = useRouter();

  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [summary, setSummary] = useState<Record<string, DayStatus>>({});
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [daySlots, setDaySlots] = useState<Slot[]>([]);
  const [daySlotsLoading, setDaySlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const todayStr = toLocalDateString(new Date());

  const isCurrentMonth =
    viewMonth.getFullYear() === new Date().getFullYear() &&
    viewMonth.getMonth() === new Date().getMonth();
  const monthLabel = viewMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    setSummaryError(false);
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth() + 1;
    fetch(`/api/slots/availability-calendar?year=${year}&month=${month}`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Gagal memuat kalender.");
        return r.json();
      })
      .then((d) => setSummary(d.summary || {}))
      .catch(() => setSummaryError(true))
      .finally(() => setSummaryLoading(false));
  }, [viewMonth]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Reset tanggal/jam terpilih setiap pindah bulan, supaya tidak ada
  // sisa pilihan dari bulan sebelumnya yang membingungkan.
  function goToMonth(offset: number) {
    setSelectedDate(null);
    setSelectedTime(null);
    setViewMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      next.setDate(1);
      return next;
    });
  }

  // Tanggal-tanggal kalender, termasuk padding di awal supaya hari pertama
  // bulan jatuh di kolom hari yang benar (Minggu = kolom 0).
  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    const cells: (string | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(toLocalDateString(new Date(year, month, day)));
    }
    return cells;
  }, [viewMonth]);

  function handleSelectDate(dateStr: string, status: DayStatus) {
    if (status !== "available") return;
    setSelectedTime(null);
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr));
  }

  // Muat jam-jam kosong (gabungan semua barber) begitu satu tanggal dipilih
  useEffect(() => {
    if (!selectedDate) {
      setDaySlots([]);
      return;
    }
    setDaySlotsLoading(true);
    fetch(`/api/slots?date=${selectedDate}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDaySlots(d.slots || []))
      .catch(() => setDaySlots([]))
      .finally(() => setDaySlotsLoading(false));
  }, [selectedDate]);

  // Jam unik yang masih punya minimal satu slot kosong (dari barber
  // manapun), diurutkan. Kita tampilkan per-jam, bukan per-barber, karena
  // di tahap ini pelanggan belum perlu tahu nama barber — itu baru
  // ditentukan nanti di flow booking.
  const availableTimes = useMemo(() => {
    const set = new Set<string>();
    for (const slot of daySlots) {
      if (slot.is_available) set.add(slot.start_time);
    }
    return Array.from(set).sort();
  }, [daySlots]);

  function handleBooking() {
    if (!selectedDate || !selectedTime) return;
    router.push(`/booking?date=${selectedDate}&time=${selectedTime}`);
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-border-soft bg-surface px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={15} className="text-text-tertiary" />
          <p className="font-display text-sm font-bold capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            disabled={isCurrentMonth}
            aria-label="Bulan sebelumnya"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border border-border-soft transition-colors",
              isCurrentMonth
                ? "cursor-not-allowed text-text-tertiary/40"
                : "text-text-secondary hover:border-accent/40 hover:text-text-primary"
            )}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Bulan berikutnya"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border-soft text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Keterangan warna */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-status-done" /> Ada slot
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-status-cancelled/70" /> Penuh
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary/40" /> Belum ada jadwal
        </span>
      </div>

      {/* Nama hari */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-text-tertiary">
        {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      {/* Grid tanggal */}
      {summaryLoading ? (
        <div className="mt-1.5 grid grid-cols-7 gap-1">
          {Array(35)
            .fill(null)
            .map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
            ))}
        </div>
      ) : summaryError ? (
        <div className="mt-3 rounded-xl border border-dashed border-border-soft px-3 py-6 text-center">
          <p className="text-xs text-text-secondary">Gagal memuat kalender.</p>
          <button onClick={loadSummary} className="mt-1.5 text-xs font-semibold text-accent underline">
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-7 gap-1">
          {calendarCells.map((dateStr, i) => {
            if (!dateStr) return <div key={`pad-${i}`} />;

            const dayNum = Number(dateStr.slice(8, 10));
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const status: DayStatus = isPast ? "none" : summary[dateStr] ?? "none";
            const isSelected = dateStr === selectedDate;
            const isClickable = !isPast && status === "available";

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleSelectDate(dateStr, status)}
                disabled={!isClickable}
                aria-label={`${dayNum} ${status === "available" ? "ada slot kosong" : status === "full" ? "penuh" : "belum ada jadwal"}`}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold transition-colors",
                  isPast
                    ? "cursor-not-allowed text-text-tertiary/30"
                    : isSelected
                    ? "bg-accent text-black"
                    : isClickable
                    ? "text-text-primary hover:bg-surface-2"
                    : status === "full"
                    ? "cursor-not-allowed text-text-tertiary/50"
                    : "cursor-not-allowed text-text-tertiary/40",
                  isToday && !isSelected && "ring-1 ring-inset ring-accent/40"
                )}
              >
                {dayNum}
                {!isPast && status !== "none" && (
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full",
                      isSelected
                        ? "bg-black"
                        : status === "available"
                        ? "bg-status-done"
                        : "bg-status-cancelled/70"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Daftar jam kosong untuk tanggal terpilih */}
      {selectedDate && (
        <div className="mt-4 border-t border-border-soft pt-4">
          <p className="text-xs font-semibold text-text-secondary">
            {formatDateIndo(selectedDate)}
          </p>

          {daySlotsLoading ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array(8)
                .fill(null)
                .map((_, i) => (
                  <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-2" />
                ))}
            </div>
          ) : availableTimes.length === 0 ? (
            <p className="mt-2 text-xs text-text-tertiary">
              Slot kosong baru saja terisi. Coba pilih tanggal lain.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {availableTimes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTime((prev) => (prev === t ? null : t))}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                    selectedTime === t
                      ? "border-accent bg-accent text-black"
                      : "border-border-soft bg-surface-2 text-text-primary hover:border-accent/40"
                  )}
                >
                  {formatTime(t)}
                </button>
              ))}
            </div>
          )}

          {selectedTime && (
            <Button
              variant="order"
              fullWidth
              size="md"
              icon={<Clock3 size={15} />}
              onClick={handleBooking}
              className="mt-4"
            >
              Booking jam {formatTime(selectedTime)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

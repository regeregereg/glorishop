"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { RefreshCw, Clock, CheckCircle2, Loader2, Users } from "lucide-react";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";
import { Scissors } from "lucide-react";

type QueueItem = {
  queueNumber: number;
  id: string;
  displayName: string;
  status: string;
  barberName: string;
  barberPhotoUrl: string | null;
  serviceNames: string[];
  slotStart: string | null;
  slotEnd: string | null;
};

type QueueData = {
  date: string;
  queue: QueueItem[];
  activeCount: number;
  totalToday: number;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; badgeClass: string }
> = {
  IN_PROGRESS: {
    label: "Sedang dikerjakan",
    dotClass: "bg-status-progress animate-pulse",
    badgeClass: "text-status-progress bg-[rgba(225,143,0,0.12)]",
  },
  CONFIRMED: {
    label: "Menunggu giliran",
    dotClass: "bg-status-confirmed",
    badgeClass: "text-status-confirmed bg-[rgba(77,141,240,0.12)]",
  },
  PENDING: {
    label: "Menunggu konfirmasi",
    dotClass: "bg-status-pending",
    badgeClass: "text-text-secondary bg-surface-2",
  },
};

function formatTime(t: string | null) {
  if (!t) return "—";
  // "09:00:00" → "09:00"
  return t.slice(0, 5);
}

// Polling interval: 30 detik — cukup fresh tanpa terlalu boros request
const POLL_INTERVAL = 30_000;

export function LiveQueuePanel() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchQueue = useCallback(async (showSpin = false) => {
    if (showSpin) setSpinning(true);
    try {
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch {
      // Gagal fetch — biarkan data lama tetap tampil, jangan crash
    } finally {
      setLoading(false);
      if (showSpin) setTimeout(() => setSpinning(false), 600);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const timer = setInterval(() => fetchQueue(), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchQueue]);

  const queue = data?.queue ?? [];
  const activeCount = data?.activeCount ?? 0;

  return (
    <section id="antrian" className="mt-7 px-5 scroll-mt-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base font-bold">Antrian Hari Ini</h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-status-progress/20 px-2 py-0.5 text-[11px] font-bold text-status-progress">
              {activeCount} aktif
            </span>
          )}
        </div>
        <button
          onClick={() => fetchQueue(true)}
          aria-label="Refresh antrian"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-surface text-text-secondary transition-colors active:bg-surface-2"
        >
          <RefreshCw
            size={14}
            className={spinning ? "animate-spin" : ""}
          />
        </button>
      </div>

      {/* Last updated hint */}
      {lastUpdated && (
        <p className="mt-0.5 text-[11px] text-text-tertiary">
          Diperbarui {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · otomatis refresh tiap 30 detik
        </p>
      )}

      {/* Content */}
      <div className="mt-3">
        {loading ? (
          // Skeleton
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-[72px] animate-pulse rounded-[var(--radius-lg)] bg-surface"
              />
            ))}
          </div>
        ) : queue.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border-soft bg-surface px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2">
              <Users size={22} className="text-text-tertiary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Antrian kosong
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Belum ada booking aktif hari ini.
                <br />
                Kamu bisa langsung datang atau booking sekarang!
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((item) => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border-soft bg-surface px-3.5 py-3"
                >
                  {/* Nomor antrian */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold text-text-primary">
                    {item.queueNumber}
                  </div>

                  {/* Info utama */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {/* Nama + badge status */}
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {item.displayName}
                      </span>
                      <span
                        className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badgeClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Barber + layanan + jam */}
                    <p className="truncate text-xs text-text-secondary">
                      {item.barberName}
                      {item.serviceNames.length > 0 && (
                        <> · {item.serviceNames.join(", ")}</>
                      )}
                    </p>

                    {item.slotStart && (
                      <p className="flex items-center gap-1 text-[11px] text-text-tertiary">
                        <Clock size={10} />
                        {formatTime(item.slotStart)}
                        {item.slotEnd && ` – ${formatTime(item.slotEnd)}`}
                      </p>
                    )}
                  </div>

                  {/* Foto barber (mini) */}
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border-soft bg-surface-2">
                    {item.barberPhotoUrl ? (
                      <Image
                        src={item.barberPhotoUrl}
                        alt={item.barberName}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Scissors size={14} className="text-text-tertiary" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Summary footer */}
            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-text-tertiary">
              <CheckCircle2 size={13} className="text-status-done" />
              {data?.totalToday ?? activeCount} booking terdaftar hari ini
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

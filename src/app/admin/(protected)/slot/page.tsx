"use client";

import { useEffect, useState, useCallback } from "react";
import { Staff, Slot } from "@/types";
import { Button } from "@/components/Button";
import { formatTime, toLocalDateString } from "@/lib/utils";

export default function AdminSlotPage() {
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [barberId, setBarberId] = useState("");
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [intervalMin, setIntervalMin] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/barbers").then((r) => r.json()).then((d) => {
      setBarbers(d.barbers || []);
      if (d.barbers?.[0]) setBarberId(d.barbers[0].id);
    });
  }, []);

  const loadSlots = useCallback(async () => {
    if (!barberId || !date) return;
    const res = await fetch(`/api/slots?barberId=${barberId}&date=${date}`);
    const data = await res.json();
    setSlots((data.slots || []).sort((a: Slot, b: Slot) => a.start_time.localeCompare(b.start_time)));
  }, [barberId, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  function generateTimeRanges(): { start_time: string; end_time: string }[] {
    const ranges: { start_time: string; end_time: string }[] = [];
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let current = sh * 60 + sm;
    const end = eh * 60 + em;

    while (current + intervalMin <= end) {
      const startH = Math.floor(current / 60).toString().padStart(2, "0");
      const startM = (current % 60).toString().padStart(2, "0");
      const next = current + intervalMin;
      const endH = Math.floor(next / 60).toString().padStart(2, "0");
      const endM = (next % 60).toString().padStart(2, "0");
      ranges.push({ start_time: `${startH}:${startM}`, end_time: `${endH}:${endM}` });
      current = next;
    }
    return ranges;
  }

  async function handleGenerate() {
    if (!barberId || !date) return;
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barber_id: barberId, date, slots: generateTimeRanges() }),
      });
      if (res.ok) {
        setMessage("Slot berhasil dibuat.");
        loadSlots();
      } else {
        const data = await res.json();
        setMessage(data.error || "Gagal membuat slot.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold">Kelola Slot</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Generate slot waktu tersedia untuk setiap barber per tanggal.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
          <h2 className="font-display text-sm font-bold">Generate Slot Baru</h2>

          <div className="mt-4 flex flex-col gap-3">
            <select
              value={barberId}
              onChange={(e) => setBarberId(e.target.value)}
              className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            >
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-secondary">Jam mulai</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-text-secondary">Jam selesai</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Interval (menit)</label>
              <select
                value={intervalMin}
                onChange={(e) => setIntervalMin(Number(e.target.value))}
                className="w-full rounded-xl border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
              >
                {[15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} menit
                  </option>
                ))}
              </select>
            </div>

            {message && (
              <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">{message}</p>
            )}

            <Button onClick={handleGenerate} disabled={generating} className="mt-1">
              {generating ? "Membuat slot..." : "Generate Slot"}
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
          <h2 className="font-display text-sm font-bold">
            Slot Tanggal {date}
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {slots.map((s) => (
              <div
                key={s.id}
                className={`rounded-xl border px-3 py-2.5 text-center text-xs font-semibold ${
                  s.is_available
                    ? "border-status-done/30 bg-status-done/10 text-status-done"
                    : "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled"
                }`}
              >
                {formatTime(s.start_time)}
              </div>
            ))}
            {slots.length === 0 && (
              <p className="col-span-3 text-sm text-text-secondary">
                Belum ada slot untuk tanggal ini.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Star, Clock } from "lucide-react";
import { Service, Staff, Slot } from "@/types";
import { formatServicePrice, formatRupiah, formatTime, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/Button";

type Step = "service" | "barber" | "slot" | "confirm";

function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Staff | "any" | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<{ id: string; name: string } | null | undefined>(undefined);

  // load session
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setSession(d.user));
  }, []);

  // load services
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => {
        setServices(d.services || []);
        const preselectId = searchParams.get("serviceId");
        if (preselectId) {
          const found = (d.services || []).find((s: Service) => s.id === preselectId);
          if (found) {
            setSelectedService(found);
            setStep("barber");
          }
        }
      });
  }, [searchParams]);

  // load barbers
  useEffect(() => {
    fetch("/api/barbers")
      .then((r) => r.json())
      .then((d) => {
        setBarbers(d.barbers || []);
        const preselectBarberId = searchParams.get("barberId");
        if (preselectBarberId) {
          const found = (d.barbers || []).find((b: Staff) => b.id === preselectBarberId);
          if (found) setSelectedBarber(found);
        }
      });
  }, [searchParams]);

  // generate next 7 days for date picker
  useEffect(() => {
    const today = new Date();
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d.toISOString().slice(0, 10));
    }
    setDates(arr);
    setSelectedDate(arr[0]);
  }, []);

  // load slots when entering slot step
  useEffect(() => {
    if (step !== "slot" || !selectedDate) return;
    const barberId = selectedBarber && selectedBarber !== "any" ? selectedBarber.id : "";
    const url = barberId
      ? `/api/slots?barberId=${barberId}&date=${selectedDate}`
      : `/api/slots?date=${selectedDate}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [step, selectedDate, selectedBarber]);

  function goNext() {
    if (step === "service") setStep("barber");
    else if (step === "barber") setStep("slot");
    else if (step === "slot") setStep("confirm");
  }

  function goBack() {
    if (step === "barber") setStep("service");
    else if (step === "slot") setStep("barber");
    else if (step === "confirm") setStep("slot");
    else router.back();
  }

  async function handleConfirm() {
    if (session === null) {
      router.push(`/login?next=/booking`);
      return;
    }
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedService.id,
          slot_id: selectedSlot.id,
          barber_id: selectedSlot.barber_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat booking.");
        return;
      }
      router.push("/booking/status");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const availableSlots = slots.filter((s) => s.is_available);
  const barberForSlot = (barberId: string) => barbers.find((b) => b.id === barberId);

  return (
    <div className="min-h-screen bg-bg pb-28">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border-soft bg-bg/90 px-5 py-4 backdrop-blur-lg">
        <button
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-text-secondary"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="font-display text-lg font-bold">
          {step === "service" && "Pilih Layanan"}
          {step === "barber" && "Pilih Barber"}
          {step === "slot" && "Pilih Tanggal & Waktu"}
          {step === "confirm" && "Konfirmasi Booking"}
        </h1>
      </header>

      {/* Step indicator */}
      <div className="flex gap-1.5 px-5 pt-4">
        {(["service", "barber", "slot", "confirm"] as Step[]).map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              s === step || ["service", "barber", "slot", "confirm"].indexOf(s) < ["service", "barber", "slot", "confirm"].indexOf(step)
                ? "bg-accent"
                : "bg-border-soft"
            )}
          />
        ))}
      </div>

      <div className="px-5 pt-5">
        {/* STEP: SERVICE */}
        {step === "service" && (
          <div className="flex flex-col gap-3">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedService(s);
                  goNext();
                }}
                className={cn(
                  "flex items-center justify-between rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                  selectedService?.id === s.id
                    ? "border-accent"
                    : "border-border-soft hover:border-accent/40"
                )}
              >
                <div>
                  <p className="font-display text-sm font-semibold">{s.name}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                    <Clock size={12} /> {s.duration_minutes} menit
                  </p>
                </div>
                <p className="font-display text-sm font-bold text-accent">
                  {formatServicePrice(s)}
                </p>
              </button>
            ))}
            {services.length === 0 && (
              <p className="py-10 text-center text-sm text-text-secondary">Memuat layanan...</p>
            )}
          </div>
        )}

        {/* STEP: BARBER */}
        {step === "barber" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setSelectedBarber("any");
                goNext();
              }}
              className={cn(
                "flex items-center gap-4 rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                selectedBarber === "any" ? "border-accent" : "border-border-soft hover:border-accent/40"
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent font-display font-bold">
                ?
              </div>
              <div>
                <p className="font-display text-sm font-semibold">Tanpa Preferensi</p>
                <p className="text-xs text-text-secondary">Sistem akan assign barber otomatis</p>
              </div>
            </button>
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBarber(b);
                  goNext();
                }}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                  selectedBarber !== "any" && selectedBarber?.id === b.id
                    ? "border-accent"
                    : "border-border-soft hover:border-accent/40"
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent font-display font-bold">
                  {b.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-display text-sm font-semibold">{b.name}</p>
                  <p className="flex items-center gap-1 text-xs text-text-secondary">
                    <Star size={11} className="fill-accent text-accent" /> 4.9
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP: SLOT */}
        {step === "slot" && (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dates.map((d) => {
                const dateObj = new Date(d + "T00:00:00");
                const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "short" });
                const dayNum = dateObj.getDate();
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      "flex shrink-0 flex-col items-center rounded-2xl px-4 py-3 text-xs font-medium",
                      selectedDate === d
                        ? "bg-accent text-black"
                        : "bg-surface border border-border-soft text-text-secondary"
                    )}
                  >
                    <span>{dayNum}</span>
                    <span className="mt-0.5">{dayName}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {availableSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => {
                    setSelectedSlot(slot);
                    goNext();
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-colors",
                    selectedSlot?.id === slot.id
                      ? "border-accent bg-accent text-black"
                      : "border-border-soft bg-surface text-text-primary hover:border-accent/40"
                  )}
                >
                  {formatTime(slot.start_time)}
                  {!selectedBarber || selectedBarber === "any" ? (
                    <span className="mt-0.5 block text-[10px] font-normal text-text-tertiary">
                      {barberForSlot(slot.barber_id)?.name ?? ""}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {availableSlots.length === 0 && (
              <p className="py-10 text-center text-sm text-text-secondary">
                Tidak ada slot tersedia di tanggal ini. Coba pilih tanggal lain.
              </p>
            )}
          </div>
        )}

        {/* STEP: CONFIRM */}
        {step === "confirm" && selectedService && selectedSlot && (
          <div className="flex flex-col gap-4">
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
              <p className="text-xs text-text-secondary">Layanan</p>
              <p className="font-display mt-1 text-base font-bold">{selectedService.name}</p>

              <div className="my-4 h-px bg-border-soft" />

              <p className="text-xs text-text-secondary">Barber</p>
              <p className="font-display mt-1 text-sm font-semibold">
                {selectedBarber === "any"
                  ? "Sesuai ketersediaan"
                  : barberForSlot(selectedSlot.barber_id)?.name ?? "—"}
              </p>

              <div className="my-4 h-px bg-border-soft" />

              <p className="text-xs text-text-secondary">Tanggal & Waktu</p>
              <p className="font-display mt-1 text-sm font-semibold">
                {formatDateShort(selectedSlot.date)} • {formatTime(selectedSlot.start_time)}
              </p>

              <div className="my-4 h-px bg-border-soft" />

              <p className="text-xs text-text-secondary">Estimasi Harga</p>
              <p className="font-display mt-1 text-base font-bold text-accent">
                {formatServicePrice(selectedService)}
              </p>
            </div>

            {session === null && (
              <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
                Kamu perlu login untuk menyelesaikan booking ini.
              </p>
            )}

            {error && (
              <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {step === "confirm" && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button size="lg" fullWidth onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Memproses..." : session === null ? "Login & Booking" : "Konfirmasi Booking"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense>
      <BookingFlow />
    </Suspense>
  );
}

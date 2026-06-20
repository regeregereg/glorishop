"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Star, Clock } from "lucide-react";
import { Service, Staff, Slot } from "@/types";
import { formatServicePrice, formatRupiah, formatTime, formatDateShort, toLocalDateString, cn } from "@/lib/utils";
import { Button } from "@/components/Button";

type Step = "service" | "barber" | "slot" | "confirm" | "payment";
type PaymentTypeChoice = "DP" | "FULL";

function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<Staff | "any" | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [paymentTypeChoice, setPaymentTypeChoice] = useState<PaymentTypeChoice>("DP");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  // data setting publik (QRIS, dll) + booking yang baru dibuat (menunggu bukti transfer)
  const [paymentSettings, setPaymentSettings] = useState<{
    qris_image_url: string | null;
    payment_account_name: string | null;
    dp_percentage: string | null;
  } | null>(null);
  const [createdBooking, setCreatedBooking] = useState<{
    id: string;
    payment: { id: string; amount: number; payment_type: PaymentTypeChoice; expires_at: string } | null;
  } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  // load session
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSession(d.user));
  }, []);

  // load setting pembayaran publik (QRIS, nama rekening, persentase DP)
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setPaymentSettings(d.settings || null))
      .catch(() => setPaymentSettings(null));
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

  // generate semua tanggal di bulan yang sedang dilihat (viewMonth) untuk date picker
  useEffect(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      arr.push(toLocalDateString(new Date(year, month, day)));
    }
    setDates(arr);

    // kalau tanggal yang sedang dipilih bukan di bulan ini, pilih tanggal
    // pertama yang valid (hari ini kalau bulan ini, atau tanggal 1 kalau
    // bulan depan; tidak boleh memilih tanggal yang sudah lewat)
    const todayStr = toLocalDateString(new Date());
    setSelectedDate((prev) => {
      if (prev && arr.includes(prev) && prev >= todayStr) return prev;
      const firstValid = arr.find((d) => d >= todayStr);
      return firstValid || arr[0];
    });
  }, [viewMonth]);

  function goToMonth(offset: number) {
    setViewMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      next.setDate(1);
      return next;
    });
  }

  const todayStr = toLocalDateString(new Date());
  const isCurrentMonth =
    viewMonth.getFullYear() === new Date().getFullYear() &&
    viewMonth.getMonth() === new Date().getMonth();
  const monthLabel = viewMonth.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  // load slots when entering slot step
  useEffect(() => {
    if (step !== "slot" || !selectedDate) return;
    const barberId = selectedBarber && selectedBarber !== "any" ? selectedBarber.id : "";
    const url = barberId
      ? `/api/slots?barberId=${barberId}&date=${selectedDate}`
      : `/api/slots?date=${selectedDate}`;
    setSlotsLoading(true);
    setSlotsError("");
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || `Gagal memuat slot (status ${r.status})`);
        }
        return r.json();
      })
      .then((d) => setSlots(d.slots || []))
      .catch((err) => {
        setSlots([]);
        setSlotsError(err.message || "Gagal memuat slot. Coba lagi.");
      })
      .finally(() => setSlotsLoading(false));
  }, [step, selectedDate, selectedBarber]);

  function goNext() {
    if (step === "service") setStep("barber");
    else if (step === "barber") setStep("slot");
    else if (step === "slot") setStep("confirm");
    else if (step === "confirm") setStep("payment");
  }

  function goBack() {
    if (step === "barber") setStep("service");
    else if (step === "slot") setStep("barber");
    else if (step === "confirm") setStep("slot");
    else if (step === "payment" && !createdBooking) setStep("confirm");
    else router.back();
  }

  function handleConfirm() {
    if (session === null) {
      router.push(`/login?next=/booking`);
      return;
    }
    setStep("payment");
  }

  async function handleCreateBooking() {
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
          payment_type: paymentTypeChoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat booking.");
        return;
      }
      setCreatedBooking(data.booking);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadProof() {
    if (!proofFile || !createdBooking) return;
    setUploadingProof(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("booking_id", createdBooking.id);
      const res = await fetch("/api/payments/upload-proof", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengunggah bukti transfer.");
        return;
      }
      setUploadDone(true);
      setTimeout(() => router.push("/booking/status"), 1200);
    } catch {
      setError("Gagal mengunggah bukti transfer. Coba lagi.");
    } finally {
      setUploadingProof(false);
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
          {step === "payment" && "Pembayaran"}
        </h1>
      </header>

      {/* Step indicator */}
      <div className="flex gap-1.5 px-5 pt-4">
        {(["service", "barber", "slot", "confirm", "payment"] as Step[]).map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              s === step || ["service", "barber", "slot", "confirm", "payment"].indexOf(s) < ["service", "barber", "slot", "confirm", "payment"].indexOf(step)
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
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-accent font-display font-bold">
                  {b.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.photo_url} alt={b.name} className="h-full w-full object-cover" />
                  ) : (
                    b.name.slice(0, 2).toUpperCase()
                  )}
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
            {/* Foto barber yang dipilih, tampil di atas seperti referensi */}
            {selectedBarber && selectedBarber !== "any" && (
              <div className="relative mb-5 -mx-5 h-56 w-[calc(100%+2.5rem)] overflow-hidden sm:rounded-3xl sm:mx-0 sm:w-full">
                {selectedBarber.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedBarber.photo_url}
                    alt={selectedBarber.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 via-surface to-accent-soft">
                    <span className="font-display text-3xl font-bold text-accent/60">
                      {selectedBarber.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  <div>
                    <p className="font-display text-base font-bold text-white">
                      {selectedBarber.name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-white/80">
                      <Star size={11} className="fill-accent text-accent" /> 4.9
                      <span className="text-white/50">• Pro Barber</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Header bulan dengan navigasi maju/mundur */}
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold capitalize">{monthLabel}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  disabled={isCurrentMonth}
                  aria-label="Bulan sebelumnya"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border border-border-soft transition-colors",
                    isCurrentMonth
                      ? "cursor-not-allowed text-text-tertiary/40"
                      : "text-text-secondary hover:border-accent/40 hover:text-text-primary"
                  )}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  aria-label="Bulan berikutnya"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <p className="mb-3 mt-4 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Tanggal
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {dates.map((d) => {
                const dateObj = new Date(d + "T00:00:00");
                const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "short" });
                const dayNum = dateObj.getDate();
                const isPast = d < todayStr;
                return (
                  <button
                    key={d}
                    onClick={() => !isPast && setSelectedDate(d)}
                    disabled={isPast}
                    className={cn(
                      "flex shrink-0 flex-col items-center rounded-2xl px-4 py-3 text-xs font-medium transition-colors",
                      selectedDate === d
                        ? "bg-text-primary text-bg"
                        : isPast
                        ? "cursor-not-allowed bg-surface/50 text-text-tertiary/40"
                        : "bg-surface border border-border-soft text-text-secondary hover:border-accent/40"
                    )}
                  >
                    <span className="text-sm font-semibold">{dayNum}</span>
                    <span className="mt-0.5 uppercase">{dayName}</span>
                  </button>
                );
              })}
            </div>

            <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Waktu
            </p>

            {slotsLoading && (
              <p className="py-10 text-center text-sm text-text-secondary">Memuat slot waktu...</p>
            )}

            {!slotsLoading && slotsError && (
              <div className="mt-5 rounded-2xl border border-status-cancelled/30 bg-status-cancelled/10 px-4 py-4 text-center">
                <p className="text-sm text-status-cancelled">{slotsError}</p>
                <button
                  onClick={() => setSelectedDate((d) => d)}
                  className="mt-2 text-xs font-medium text-accent underline"
                >
                  Coba lagi
                </button>
              </div>
            )}

            {!slotsLoading && !slotsError && (
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
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && (
              <p className="py-10 text-center text-sm text-text-secondary">
                Belum ada slot waktu yang dibuat untuk tanggal ini. Silakan pilih tanggal lain
                atau hubungi barbershop langsung.
              </p>
            )}

            {!slotsLoading && !slotsError && slots.length > 0 && availableSlots.length === 0 && (
              <p className="py-10 text-center text-sm text-text-secondary">
                Semua slot di tanggal ini sudah penuh dibooking. Coba pilih tanggal lain.
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

        {/* STEP: PAYMENT */}
        {step === "payment" && selectedService && selectedSlot && (
          <div className="flex flex-col gap-4">
            {!createdBooking ? (
              <>
                <p className="text-sm text-text-secondary">
                  Pilih jenis pembayaran untuk mengamankan slot kamu. Booking akan
                  diverifikasi admin setelah bukti transfer diunggah.
                </p>

                {(() => {
                  const dpPercent = Number(paymentSettings?.dp_percentage ?? 50) || 50;
                  const basePrice = selectedService.price ?? selectedService.price_min ?? 0;
                  const dpAmount = Math.ceil((basePrice * dpPercent) / 100);
                  return (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => setPaymentTypeChoice("DP")}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                          paymentTypeChoice === "DP" ? "border-accent" : "border-border-soft hover:border-accent/40"
                        )}
                      >
                        <div>
                          <p className="font-display text-sm font-semibold">DP {dpPercent}%</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            Sisa dibayar di tempat setelah layanan selesai.
                          </p>
                        </div>
                        <p className="font-display text-sm font-bold text-accent">
                          {formatRupiah(dpAmount)}
                        </p>
                      </button>

                      <button
                        onClick={() => setPaymentTypeChoice("FULL")}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border bg-surface px-4 py-4 text-left transition-colors",
                          paymentTypeChoice === "FULL" ? "border-accent" : "border-border-soft hover:border-accent/40"
                        )}
                      >
                        <div>
                          <p className="font-display text-sm font-semibold">Bayar Lunas</p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            Bayar penuh sekarang, tidak ada tagihan susulan.
                          </p>
                        </div>
                        <p className="font-display text-sm font-bold text-accent">
                          {formatRupiah(basePrice)}
                        </p>
                      </button>
                    </div>
                  );
                })()}

                <p className="text-xs text-text-tertiary">
                  Setelah lanjut, kamu akan diberi 30 menit untuk mengirim bukti transfer
                  sebelum slot ini dilepas kembali.
                </p>

                {error && (
                  <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                    {error}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 text-center">
                  <p className="text-xs text-text-secondary">Total yang harus dibayar</p>
                  <p className="font-display mt-1 text-2xl font-bold text-accent">
                    {formatRupiah(createdBooking.payment?.amount ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {createdBooking.payment?.payment_type === "FULL" ? "Bayar Lunas" : "Down Payment (DP)"}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
                  {paymentSettings?.qris_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={paymentSettings.qris_image_url}
                      alt="QRIS Glori Barbershop"
                      className="h-56 w-56 rounded-xl object-contain"
                    />
                  ) : (
                    <p className="py-10 text-center text-sm text-text-secondary">
                      QRIS belum diatur admin. Silakan hubungi barbershop langsung untuk
                      info pembayaran.
                    </p>
                  )}
                  <p className="text-xs text-text-secondary">
                    Scan QRIS di atas lewat e-wallet atau m-banking, lalu unggah bukti
                    transfer di bawah.
                  </p>
                </div>

                {!uploadDone ? (
                  <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-5">
                    <p className="mb-2 text-sm font-medium text-text-secondary">
                      Unggah Bukti Transfer
                    </p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-xl file:border file:border-border-soft file:bg-surface-2 file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-text-primary"
                    />
                    {proofFile && (
                      <p className="mt-2 text-xs text-text-tertiary">{proofFile.name}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-card)] border border-status-confirmed/30 bg-status-confirmed/10 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-status-confirmed">
                      Bukti transfer terkirim!
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Admin akan memverifikasi pembayaranmu. Mengalihkan ke status booking...
                    </p>
                  </div>
                )}

                {error && (
                  <p className="rounded-xl bg-status-cancelled/10 px-4 py-3 text-sm text-status-cancelled">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {step === "confirm" && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button size="lg" fullWidth onClick={handleConfirm} disabled={submitting}>
            {session === null ? "Login & Lanjutkan" : "Lanjut ke Pembayaran"}
          </Button>
        </div>
      )}

      {step === "payment" && !createdBooking && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button size="lg" fullWidth onClick={handleCreateBooking} disabled={submitting}>
            {submitting ? "Memproses..." : "Buat Booking & Tampilkan QRIS"}
          </Button>
        </div>
      )}

      {step === "payment" && createdBooking && !uploadDone && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border-soft bg-surface/95 px-5 py-4 backdrop-blur-lg">
          <Button size="lg" fullWidth onClick={handleUploadProof} disabled={uploadingProof || !proofFile}>
            {uploadingProof ? "Mengunggah..." : "Kirim Bukti Transfer"}
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

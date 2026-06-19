"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Scissors, Droplet, Palette, Sparkles, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_COOKIE = "glori_onboarded";

// Taruh foto kamu di /public/onboarding/ dengan nama file persis seperti di
// bawah ini (haircut.jpg, shaving.jpg, dst). Kalau file belum ada / gagal
// dimuat, kartu otomatis fallback ke gradient + ikon supaya tetap rapi.
const SLIDES = [
  { src: "/onboarding/haircut.jpeg", label: "Hair Cut", Icon: Scissors },
  { src: "/onboarding/shaving.jepg", label: "Shaving", Icon: Droplet },
  { src: "/onboarding/coloring.jpeg", label: "Coloring", Icon: Palette },
  { src: "/onboarding/treatment.jpeg", label: "Treatment", Icon: Sparkles },
];

function finishOnboarding() {
  const todayKey = new Date().toISOString().slice(0, 10);
  // Cookie cuma perlu hidup ~2 hari — tiap hari baru, middleware akan minta
  // onboarding lagi karena tanggalnya sudah tidak cocok.
  document.cookie = `${ONBOARDING_COOKIE}=${todayKey}; path=/; max-age=${60 * 60 * 48}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ active: false, startX: 0, startScroll: 0 });
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [failed, setFailed] = useState<Set<number>>(new Set());

  function markFailed(i: number) {
    setFailed((prev) => new Set(prev).add(i));
  }

  function nearestIndex(): number {
    const track = trackRef.current;
    if (!track) return 0;
    const children = Array.from(track.children) as HTMLElement[];
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    children.forEach((child, i) => {
      const childCenter = child.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    return closest;
  }

  function goToSlide(index: number) {
    const track = trackRef.current;
    const child = track?.children[index] as HTMLElement | undefined;
    if (!track || !child) return;
    const target = child.offsetLeft - (track.clientWidth - child.clientWidth) / 2;
    track.scrollTo({ left: target, behavior: "smooth" });
    setActiveSlide(index);
  }

  // Geser pakai mouse (drag) di desktop — di HP/tablet swipe sudah jalan
  // otomatis lewat scroll bawaan browser (CSS scroll-snap).
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const track = trackRef.current;
    if (!track) return;
    dragState.current = { active: true, startX: e.clientX, startScroll: track.scrollLeft };
    track.setPointerCapture(e.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current.active) return;
    const track = trackRef.current;
    if (!track) return;
    const dx = e.clientX - dragState.current.startX;
    track.scrollLeft = dragState.current.startScroll - dx;
  }

  function endDrag() {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    setIsDragging(false);
    goToSlide(nearestIndex());
  }

  function handleScroll() {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!dragState.current.active) setActiveSlide(nearestIndex());
    }, 80);
  }

  function handleEnter() {
    finishOnboarding();
    router.push("/");
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg pb-10 pt-6">
      {/* Ambient glow di latar belakang biar tidak polos */}
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-accent/20 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 top-64 h-56 w-56 rounded-full bg-accent/10 blur-[80px]" />

      {/* Carousel foto — bisa digeser pakai tangan (swipe) atau drag mouse */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className={cn(
          "relative z-10 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth px-[11%] [-ms-overflow-style:none] [scroll-padding-inline:11%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.label}
            className="relative h-[360px] w-[78%] shrink-0 select-none overflow-hidden rounded-[28px] border border-border-soft snap-center"
          >
            {!failed.has(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.src}
                alt={slide.label}
                draggable={false}
                onError={() => markFailed(i)}
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center",
                  i % 2 === 0
                    ? "bg-gradient-to-br from-surface-2 via-surface to-accent-soft"
                    : "bg-gradient-to-tr from-accent-soft via-surface to-surface-2"
                )}
              >
                <slide.Icon size={64} strokeWidth={1.1} className="text-accent/50" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              {slide.label}
            </span>
          </div>
        ))}
      </div>

      {/* Dot indicators — ikut posisi carousel */}
      <div className="relative z-10 mt-4 flex items-center justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Slide ${i + 1}`}
            onClick={() => goToSlide(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === activeSlide ? "w-6 bg-accent" : "w-1.5 bg-border-soft"
            )}
          />
        ))}
      </div>

      {/* Copy — statis, persis seperti referensi */}
      <div className="relative z-10 mt-7 flex-1 px-6">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] text-text-primary">
          Barber <span className="text-accent">Appointments</span>
          <br />
          Made Easy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Booking janji dengan mudah, jelajahi profil barber, dan lihat menu
          layanan kapan saja.
        </p>
      </div>

      {/* CTA — sekali klik langsung masuk ke aplikasi */}
      <div className="relative z-10 mt-6 flex items-center gap-3 px-6">
        <button
          onClick={handleEnter}
          className="flex-1 rounded-full bg-accent py-4 text-sm font-bold text-black transition-transform active:scale-[0.98]"
        >
          Booking Now
        </button>
        <button
          onClick={handleEnter}
          aria-label="Masuk ke aplikasi"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-2 text-text-primary transition-transform active:scale-[0.95]"
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
    </div>
  );
}

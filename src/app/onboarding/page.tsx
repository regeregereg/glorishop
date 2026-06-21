"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Image from "next/image";
import { Scissors, Droplet, Palette, Sparkles, ArrowUpRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhotoPlaceholder } from "@/components/PhotoPlaceholder";

const ONBOARDING_COOKIE = "glori_onboarded";

// Taruh foto kamu di /public/onboarding/ dengan nama file persis seperti di
// bawah ini (haircut.jpg, shaving.jpg, dst). Kalau file belum ada / gagal
// dimuat, kartu otomatis fallback ke gradient + ikon supaya tetap rapi.
const SLIDES = [
  {
    src: "/onboarding/haircut.jpeg",
    label: "Hair Cut",
    Icon: Scissors,
    cta: "Look Sharp",
    desc: "Presisi tinggi, hasil sempurna",
  },
  {
    src: "/onboarding/shaving.jpeg",
    label: "Shaving",
    Icon: Droplet,
    cta: "Feel Clean",
    desc: "Cukur klasik, rasa premium",
  },
  {
    src: "/onboarding/coloring.jpeg",
    label: "Coloring",
    Icon: Palette,
    cta: "Go Bold",
    desc: "Warna tahan lama & natural",
  },
  {
    src: "/onboarding/treatment.jpeg",
    label: "Treatment",
    Icon: Sparkles,
    cta: "Stay Fresh",
    desc: "Perawatan rambut profesional",
  },
];

function finishOnboarding() {
  const todayKey = new Date().toISOString().slice(0, 10);
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg pb-10 pt-8">

      {/* ── Ambient glow — lebih kaya dari sebelumnya ── */}
      <div className="pointer-events-none absolute -left-32 -top-8 h-72 w-72 rounded-full bg-accent/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-24 top-56 h-64 w-64 rounded-full bg-accent/8 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-accent/5 blur-[80px]" />

      {/* ── Brand mark — eyebrow di atas carousel ── */}
      <div className="relative z-10 mb-5 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          {/* Scissor logomark kecil */}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
            <Scissors size={14} strokeWidth={2.5} className="text-black" />
          </div>
          <span className="font-display text-[15px] font-extrabold tracking-tight text-text-primary">
            GLORI
          </span>
        </div>
        {/* Social proof chip */}
        <div className="flex items-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 py-1">
          <Star size={11} className="fill-accent text-accent" />
          <span className="text-[11px] font-semibold text-text-secondary">4.9 · 2.000+ klien</span>
        </div>
      </div>

      {/* ── Carousel foto ── */}
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
            className="onboarding-card-reveal relative h-[370px] w-[78%] shrink-0 select-none overflow-hidden rounded-[28px] snap-center"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset",
              animationDelay: `${i * 0.12}s`,
            }}
          >
            {/* Gambar / fallback */}
            {!failed.has(i) ? (
              <Image
                src={slide.src}
                alt={slide.label}
                fill
                sizes="78vw"
                draggable={false}
                priority={i === 0}
                onError={() => markFailed(i)}
                className="pointer-events-none object-cover transition-transform duration-700"
              />
            ) : (
              <PhotoPlaceholder icon={<slide.Icon size={64} strokeWidth={1.1} />} />
            )}

            {/* Gradient overlay bawah — lebih dalam & dramatis */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

            {/* Shine sweep — sapuan cahaya tipis sekali jalan saat kartu pertama muncul,
                kesan premium tanpa mengganggu konten */}
            <div
              className="onboarding-shine pointer-events-none absolute inset-0"
              style={{ animationDelay: `${0.4 + i * 0.12}s` }}
            />

            {/* CTA editorial — pojok kanan atas, gaya magazine bold */}
            <div className="absolute right-4 top-4 text-right">
              {slide.cta.split(" ").map((word, wi) => (
                <div
                  key={wi}
                  className="block font-display font-extrabold leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  style={{ fontSize: "clamp(18px, 5.5vw, 26px)" }}
                >
                  {word}
                </div>
              ))}
            </div>

            {/* Info bawah kartu — label + deskripsi singkat */}
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-[11px] font-semibold text-white/60">{slide.desc}</p>
              <span className="mt-0.5 inline-block text-[15px] font-bold text-white">
                {slide.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dot indicators — lebih halus ── */}
      <div className="relative z-10 mt-5 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Slide ${i + 1}`}
            onClick={() => goToSlide(i)}
            className={cn(
              "rounded-full transition-all duration-300",
              i === activeSlide
                ? "h-1.5 w-7 bg-accent"
                : "h-1.5 w-1.5 bg-border-soft hover:bg-text-tertiary"
            )}
          />
        ))}
      </div>

      {/* ── Copy section — hierarki lebih kuat ── */}
      <div className="relative z-10 mt-8 flex-1 px-6">
        {/* Eyebrow label */}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
          Premium Barbershop · Sejak 2020
        </p>

        <h1 className="font-display text-[32px] font-extrabold leading-[1.1] text-text-primary">
          Tampil Terbaik,{" "}
          <br />
          <span className="text-accent">Booking Mudah.</span>
        </h1>

        <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
          Pilih barber, tentukan layanan, dan konfirmasi jadwal — semua dalam
          hitungan detik.
        </p>

        {/* Trust badges kecil */}
        <div className="mt-5 flex items-center gap-4">
          {[
            { val: "4+", lbl: "Layanan" },
            { val: "100%", lbl: "Terjamin" },
            { val: "Fast", lbl: "Booking" },
          ].map(({ val, lbl }) => (
            <div key={lbl} className="flex flex-col">
              <span className="text-[15px] font-bold text-text-primary">{val}</span>
              <span className="text-[11px] text-text-tertiary">{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA — lebih premium ── */}
      <div className="relative z-10 mt-7 px-6">
        {/* Divider tipis */}
        <div className="mb-5 h-px bg-gradient-to-r from-transparent via-border-soft to-transparent" />

        <div className="flex items-center gap-3">
          <button
            onClick={handleEnter}
            className="flex-1 rounded-full bg-gradient-to-r from-accent-order-from to-accent-order-to py-[15px] text-[15px] font-bold text-white shadow-[0_4px_20px_-2px_var(--accent-order-glow)] transition-all duration-200 active:scale-[0.97]"
          >
            Booking Sekarang
          </button>
          <button
            onClick={handleEnter}
            aria-label="Masuk ke aplikasi"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-2 text-text-primary transition-all duration-200 active:scale-[0.95] hover:border-accent/40 hover:bg-surface"
          >
            <ArrowUpRight size={20} />
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-text-tertiary">
          Daftar menggunakan no Wa · Langsung booking
        </p>
      </div>
    </div>
  );
}

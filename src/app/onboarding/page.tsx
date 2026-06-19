"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Scissors,
  Users,
  CalendarCheck,
  Star,
  Sparkles,
  Droplet,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_COOKIE = "glori_onboarded";

type Slide = {
  chip: string;
  Icon: typeof Scissors;
  headline: [string, string, string];
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    chip: "Hair Cut",
    Icon: Scissors,
    headline: ["Barber", "Appointments", "Made Easy"],
    subtitle:
      "Booking janji potong rambut, jelajahi profil barber, dan lihat menu layanan dengan mudah.",
  },
  {
    chip: "Pilih Barber",
    Icon: Users,
    headline: ["Pilih Barber", "Favoritmu", "Sendiri"],
    subtitle:
      "Lihat profil, rating, dan keahlian tiap barber sebelum kamu memutuskan booking.",
  },
  {
    chip: "Tepat Waktu",
    Icon: CalendarCheck,
    headline: ["Datang Pas", "Waktunya,", "Tanpa Antri"],
    subtitle:
      "Pilih slot jadwal yang kosong, lalu pantau status booking kamu secara langsung.",
  },
];

function finishOnboarding() {
  document.cookie = `${ONBOARDING_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  function handleNext() {
    if (isLast) {
      finishOnboarding();
      router.push("/");
      return;
    }
    setIndex((i) => i + 1);
  }

  function handleSkip() {
    finishOnboarding();
    router.push("/");
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg px-6 pb-10 pt-6">
      {/* Ambient glow di latar belakang biar tidak polos */}
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-accent/20 blur-[90px]" />
      <div className="pointer-events-none absolute -right-20 top-64 h-56 w-56 rounded-full bg-accent/10 blur-[80px]" />

      {/* Skip */}
      <div className="relative z-10 flex justify-end">
        <button
          onClick={handleSkip}
          className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-secondary"
        >
          Lewati
        </button>
      </div>

      {/* Visual stage: kartu bertumpuk ala mockup, full CSS — tanpa foto eksternal */}
      <div className="relative z-10 mt-6 flex h-[340px] items-center justify-center">
        {/* Kartu belakang kiri */}
        <div className="absolute left-2 top-6 h-[260px] w-[120px] -rotate-[10deg] rounded-[26px] border border-border-soft bg-gradient-to-b from-surface-2 to-surface shadow-xl">
          <div className="flex h-full flex-col items-center justify-center gap-2 opacity-60">
            <Droplet size={22} className="text-accent" strokeWidth={1.6} />
          </div>
        </div>
        {/* Kartu belakang kanan */}
        <div className="absolute right-2 top-6 h-[260px] w-[120px] rotate-[10deg] rounded-[26px] border border-border-soft bg-gradient-to-b from-surface-2 to-surface shadow-xl">
          <div className="flex h-full flex-col items-center justify-center gap-2 opacity-60">
            <Sparkles size={22} className="text-accent" strokeWidth={1.6} />
          </div>
        </div>

        {/* Kartu depan — berubah sesuai slide aktif */}
        <div
          key={index}
          className="animate-[fadeIn_0.35s_ease] relative z-10 flex h-[300px] w-[190px] flex-col items-center justify-between overflow-hidden rounded-[28px] border border-border-soft bg-gradient-to-br from-surface-2 via-surface to-bg p-5 shadow-2xl"
        >
          <div className="flex items-center gap-1 self-end rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">
            <Star size={11} className="fill-accent text-accent" /> 4.9
          </div>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
            <slide.Icon size={34} className="text-accent" strokeWidth={1.6} />
          </div>
          <span className="rounded-full bg-black/40 px-3.5 py-1.5 text-xs font-semibold text-text-primary backdrop-blur-sm">
            {slide.chip}
          </span>
        </div>
      </div>

      {/* Dot indicators */}
      <div className="relative z-10 mt-7 flex items-center justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-accent" : "w-1.5 bg-border-soft"
            )}
          />
        ))}
      </div>

      {/* Copy */}
      <div className="relative z-10 mt-7 flex-1">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] text-text-primary">
          {slide.headline[0]}{" "}
          <span className="text-accent">{slide.headline[1]}</span>
          <br />
          {slide.headline[2]}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          {slide.subtitle}
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-10 mt-6 flex items-center gap-3">
        <button
          onClick={handleNext}
          className="flex-1 rounded-full bg-accent py-4 text-sm font-bold text-black transition-transform active:scale-[0.98]"
        >
          {isLast ? "Booking Now" : "Lanjut"}
        </button>
        <button
          onClick={handleNext}
          aria-label="Lanjut"
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-surface-2 border border-border-soft text-text-primary transition-transform active:scale-[0.95]"
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
    </div>
  );
}

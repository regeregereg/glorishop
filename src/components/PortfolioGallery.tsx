"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { BarberPortfolio } from "@/types";

export function PortfolioGallery({
  portfolio,
  barberName,
}: {
  portfolio: BarberPortfolio[];
  barberName: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (portfolio.length === 0) {
    return (
      <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-soft bg-surface px-4 py-10 text-center">
        <ImageOff size={28} className="text-text-tertiary" strokeWidth={1.3} />
        <p className="text-sm text-text-secondary">
          Belum ada foto portofolio dari {barberName.split(" ")[0]}.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {portfolio.map((p, i) => (
          <div
            key={p.id}
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border border-border-soft transition-transform active:scale-[0.97]"
          >
            <Image
              src={p.photo_url}
              alt={`Hasil karya ${barberName}`}
              fill
              sizes="(max-width: 640px) 50vw, 280px"
              loading="lazy"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          photos={portfolio}
          startIndex={openIndex}
          barberName={barberName}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

function Lightbox({
  photos,
  startIndex,
  barberName,
  onClose,
}: {
  photos: BarberPortfolio[];
  startIndex: number;
  barberName: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  // kunci scroll body selama lightbox terbuka
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // navigasi via keyboard (berguna juga di desktop)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function goNext() {
    setIndex((i) => (i + 1) % photos.length);
  }
  function goPrev() {
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }
  function handleTouchEnd() {
    const threshold = 50;
    if (touchDeltaX.current > threshold) goPrev();
    else if (touchDeltaX.current < -threshold) goNext();
    touchStartX.current = null;
    touchDeltaX.current = 0;
  }

  const current = photos[index];

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md">
          {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:scale-90"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2">
        <Image
          key={current.id}
          src={current.photo_url}
          alt={`Hasil karya ${barberName}`}
          fill
          sizes="100vw"
          className="select-none rounded-xl object-contain"
        />

        {photos.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Sebelumnya"
              className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md sm:flex"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goNext}
              aria-label="Selanjutnya"
              className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md sm:flex"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-accent" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

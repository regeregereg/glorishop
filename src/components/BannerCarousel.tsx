"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Banner {
  id: string;
  image_url: string;
}

const AUTO_SLIDE_MS = 4000;

/**
 * Carousel banner promo/event untuk Home. Swipe manual ditangani native
 * lewat CSS scroll-snap (terasa natural di mobile, tidak perlu JS drag
 * handler sendiri). Auto-slide jalan lewat scrollTo terprogram, dan
 * berhenti sebentar setiap kali pengguna swipe manual supaya tidak
 * "berebut" arah dengan gestur pengguna.
 */
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoScrolling = useRef(false);

  // Auto-slide: lanjut ke index berikutnya tiap AUTO_SLIDE_MS, berhenti
  // total kalau cuma ada 1 banner (tidak ada gunanya geser ke diri sendiri).
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const nextIndex = (activeIndex + 1) % banners.length;
      isAutoScrolling.current = true;
      track.scrollTo({ left: track.clientWidth * nextIndex, behavior: "smooth" });
      setActiveIndex(nextIndex);
    }, AUTO_SLIDE_MS);

    return () => clearInterval(interval);
  }, [activeIndex, banners.length]);

  // Lacak index aktif dari posisi scroll sebenarnya, supaya swipe manual
  // pengguna ikut update titik indikator di bawah, bukan cuma auto-slide.
  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex(index);

    // Beri jeda sebelum auto-slide lanjut lagi setelah swipe manual,
    // supaya tidak terasa "direbut" balik oleh timer.
    if (!isAutoScrolling.current) {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    }
    isAutoScrolling.current = false;
  }

  if (banners.length === 0) return null;

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b) => (
          <div key={b.id} className="relative aspect-[2/1] w-full shrink-0 snap-start">
            <Image
              src={b.image_url}
              alt=""
              fill
              sizes="(max-width: 480px) 100vw, 480px"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {banners.map((b, i) => (
            <span
              key={b.id}
              className={
                i === activeIndex
                  ? "h-1.5 w-5 rounded-full btn-order-gradient"
                  : "h-1.5 w-1.5 rounded-full bg-border-soft"
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

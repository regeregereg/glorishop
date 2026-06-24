"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { LiveQueuePanel } from "@/components/LiveQueuePanel";

export default function AntrianPage() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen flex-col bg-bg pb-10">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-soft bg-bg/80 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => router.back()}
          aria-label="Kembali"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface text-text-primary transition-all active:scale-[0.94] hover:bg-surface-2"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="flex items-center">
          <Image
            src="/glori-logo.png"
            alt="Glori Barbershop"
            width={98}
            height={36}
            className="h-9 w-auto object-contain"
          />
        </div>
      </div>

      {/* ── Live Queue Panel — langsung muncul, tidak ada noise lain ── */}
      <div className="mt-2">
        <LiveQueuePanel />
      </div>

      {/* ── Footer CTA — kalau mau langsung booking ── */}
      <div className="mt-auto px-5 pt-6">
        <div className="h-px bg-gradient-to-r from-transparent via-border-soft to-transparent mb-5" />
        <button
          onClick={() => router.push("/")}
          className="btn-order-gradient w-full rounded-full py-[15px] text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.97] [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]"
        >
          Booking Sekarang
        </button>
        <p className="mt-3 text-center text-[11px] text-text-tertiary">
          Pilih barber & layanan favorit kamu
        </p>
      </div>
    </div>
  );
}

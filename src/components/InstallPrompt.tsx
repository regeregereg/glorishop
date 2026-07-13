"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Download, X, Share, SquarePlus, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Kenapa komponen ini ada ────────────────────────────────────────────────
// Owner mendapati banyak customer awam (terutama ibu-ibu) bingung / males
// kalau harus "Add to Home Screen" manual sendiri. Solusinya beda per OS:
//
// 1) Android/Chrome/Edge/Samsung Internet: browser MEMANG menyediakan API
//    `beforeinstallprompt` yang bisa kita tangkap, lalu kita panggil sendiri
//    `.prompt()` dari tombol kita — hasilnya betul-betul 1 tap "Instal",
//    tanpa customer perlu tahu istilah "Add to Home Screen" sama sekali.
//
// 2) iOS Safari (termasuk Chrome/Firefox di iOS, karena semua browser iOS
//    wajib pakai engine WebKit-nya Apple): Apple SENGAJA TIDAK menyediakan
//    API ini. Tidak ada cara teknis apa pun — dari web biasa maupun app
//    store — untuk memicu instalasi PWA secara otomatis di iOS. Yang bisa
//    kita lakukan hanya membuat langkah manualnya SEJELAS & SESEDERHANA
//    mungkin (panduan bergambar 2 langkah), bukan menghilangkannya.
//
// Catatan lain: banner ini TIDAK muncul kalau app sudah ke-install
// (display-mode: standalone), dan tidak muncul lagi selama 14 hari kalau
// pernah ditutup manual (biar tidak berasa "iklan" yang mengganggu).

const DISMISS_KEY = "glori_install_dismissed_at";
const DISMISS_DAYS = 14;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari lama pakai properti non-standar ini
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

function wasDismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage bisa gagal di private mode — abaikan saja, tidak fatal.
  }
}

// Halaman-halaman di mana banner ini TIDAK relevan (area kerja
// admin/barber, bukan customer awam yang jadi target fitur ini).
const HIDDEN_PREFIXES = ["/admin", "/barber", "/login"];

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    // ── Jalur Android/Chrome/Edge ──
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Kasih jeda sekejap supaya tidak muncul mendadak pas halaman baru buka.
      setTimeout(() => setVisible(true), 1200);
    }

    function handleAppInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
      markDismissed();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // ── Jalur iOS Safari (tidak ada event beforeinstallprompt sama sekali,
    // jadi kita munculkan banner kita sendiri yang membuka panduan) ──
    if (isIOS()) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setShowIOSSheet(false);
    markDismissed();
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (isIOS()) {
      setShowIOSSheet(true);
      return;
    }
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      } else {
        // Ditolak sekali — jangan langsung nagih lagi, anggap seperti dismiss.
        markDismissed();
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const hiddenHere = HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));
  const canShow = !hiddenHere && visible && (deferredPrompt !== null || isIOS());

  if (!canShow && !showIOSSheet) return null;

  return (
    <>
      {/* ── Banner mengambang di atas BottomNav ── */}
      {canShow && !showIOSSheet && (
        <div
          className={cn(
            "fixed inset-x-0 z-50 flex justify-center px-4",
            "bottom-[calc(4.25rem+env(safe-area-inset-bottom))]"
          )}
        >
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border-soft bg-surface-2/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-lg">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
              <Image src="/icon-192.png" alt="" width={44} height={44} className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-text-primary">
                Instal App Glori Barbershop
              </p>
              <p className="truncate text-[11px] text-text-secondary">
                Booking lebih cepat, langsung dari layar utama HP
              </p>
            </div>
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-bold text-text-onLight-primary transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              <Download size={15} strokeWidth={2.4} />
              {installing ? "..." : "Instal"}
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Tutup"
              className="shrink-0 rounded-full p-1.5 text-text-tertiary hover:bg-white/5 hover:text-text-secondary"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Panduan 2 langkah untuk iOS Safari ──
          Ini SATU-SATUNYA cara yang Apple izinkan; tidak ada API untuk
          memicu instalasi otomatis di iOS, jadi kita buat langkahnya
          sesederhana & sejelas mungkin dengan ikon yang sama persis
          dengan yang akan dilihat customer di Safari-nya. */}
      {showIOSSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl border-t border-border-soft bg-surface p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-soft" />
            <p className="text-center text-[15px] font-bold text-text-primary">
              Instal App Glori Barbershop
            </p>
            <p className="mt-1 text-center text-[12px] text-text-secondary">
              Di iPhone, Safari minta 2 tap manual — bawaan dari Apple, bukan dari kami
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-text-primary">
                  1
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-text-primary">
                  <span>Tap ikon</span>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface">
                    <Share size={15} />
                  </span>
                  <span>di bar bawah Safari</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-text-primary">
                  2
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-text-primary">
                  <span>Pilih</span>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface">
                    <SquarePlus size={15} />
                  </span>
                  <span>&quot;Add to Home Screen&quot;</span>
                </div>
              </div>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-text-tertiary">
              <MoreVertical size={12} className="rotate-90" />
              Pakai Chrome/browser lain di iPhone? Caranya sama, cari ikon Share serupa
            </p>

            <button
              onClick={handleDismiss}
              className="mt-5 w-full rounded-2xl bg-accent py-3 text-[13px] font-bold text-text-onLight-primary active:scale-[0.98]"
            >
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}

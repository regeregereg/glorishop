"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Download, X, Share, SquarePlus, MoreVertical, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Kenapa komponen ini ada ────────────────────────────────────────────────
// Owner mendapati banyak customer awam (terutama ibu-ibu) bingung / males
// kalau harus "Add to Home Screen" manual sendiri. Ada 4 skenario nyata yang
// masing-masing butuh pendekatan beda:
//
// 1) Android/Chrome/Edge/Samsung Internet (browser BENERAN, bukan di dalam
//    app lain): browser ini menyediakan event `beforeinstallprompt` yang
//    bisa kita tangkap sendiri, lalu panggil `.prompt()` dari tombol kita —
//    hasilnya betul-betul 1 tap "Instal".
//
// 2) iOS Safari: Apple SENGAJA TIDAK menyediakan API semacam itu — tidak
//    ada cara teknis apa pun untuk memicu instalasi otomatis di iOS. Yang
//    bisa kita lakukan cuma bikin langkah manualnya sesederhana mungkin
//    (panduan bergambar 2 langkah).
//
// 3) Dibuka dari DALAM APP LAIN (Instagram/WhatsApp/Facebook/TikTok/Line) —
//    ini penyebab PALING SERING kenapa "kadang popup instal tidak muncul",
//    karena link yang di-share lewat WA/IG dibuka pakai jendela browser mini
//    (in-app WebView) milik app tsb, BUKAN Chrome/Safari asli. Google/Apple
//    sengaja menonaktifkan beforeinstallprompt di jendela mini itu — bukan
//    bug dari kita. Solusinya: deteksi kondisi ini, lalu arahkan customer
//    keluar ke browser asli dulu (di Android bisa otomatis lewat Android
//    Intent, di iOS cuma bisa dikasih instruksi 1 tap karena Apple tidak
//    kasih jalan otomatis untuk kasus ini).
//
// 4) Browser lain yang memang tidak mendukung beforeinstallprompt sama
//    sekali (mis. Firefox Android) — dikasih fallback instruksi manual
//    generik lewat menu titik-tiga bawaan browser.
//
// Catatan lain: banner ini TIDAK muncul kalau app sudah ke-install
// (display-mode: standalone), dan tidak muncul lagi selama beberapa hari
// kalau pernah ditutup manual (biar tidak berasa "iklan" yang mengganggu).
//
// PENTING — dua key terpisah, JANGAN digabung jadi satu:
// - DISMISS_KEY: dipakai kalau customer sendiri yang menutup banner (tap X)
//   atau menolak prompt native. Ini sinyal kuat "belum mau", jadi ditahan
//   agak lama (14 hari).
// - INSTALLED_KEY: dipakai HANYA saat event `appinstalled` benar-benar
//   terjadi. Ini sengaja masa berlakunya jauh lebih pendek (3 hari), karena
//   localStorage TIDAK ikut kehapus saat customer uninstall app dari HP-nya.
//   Kalau kita pakai masa berlaku 14 hari yang sama untuk "berhasil instal",
//   lalu customer uninstall besoknya, banner akan tetap tersembunyi sampai
//   14 hari walau app-nya sudah tidak ada lagi di HP mereka — persis kejadian
//   yang dilaporkan. Display-mode standalone check di atas sudah cukup
//   untuk menyembunyikan banner selama app BENERAN masih terpasang; key ini
//   cuma jaga-jaga transisi sesaat sebelum display-mode-nya kebaca standalone.
const DISMISS_KEY = "glori_install_dismissed_at";
const DISMISS_DAYS = 14;
const INSTALLED_KEY = "glori_install_installed_at";
const INSTALLED_DAYS = 3;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "native" | "ios" | "inapp-android" | "inapp-ios" | "manual";

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

// Tanda tangan User-Agent dari "jendela browser mini" (in-app WebView) milik
// app populer di Indonesia. Ini kenapa link yang disebar lewat WA/IG kadang
// gak bisa munculin popup instal — browser aslinya bukan Chrome/Safari.
function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|TikTok|musical_ly|Twitter|Snapchat|LinkedInApp/i.test(
    ua
  );
}

function isWithinDays(key: string, days: number): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  const at = Number(raw);
  if (Number.isNaN(at)) return false;
  const daysSince = (Date.now() - at) / (1000 * 60 * 60 * 24);
  return daysSince < days;
}

function setNow(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // localStorage bisa gagal di private mode — abaikan saja, tidak fatal.
  }
}

function wasDismissedRecently(): boolean {
  return isWithinDays(DISMISS_KEY, DISMISS_DAYS);
}

function markDismissed() {
  setNow(DISMISS_KEY);
}

// Lihat catatan di atas INSTALLED_KEY — sengaja terpisah dari markDismissed
// dan masa berlakunya jauh lebih pendek.
function wasRecentlyInstalled(): boolean {
  return isWithinDays(INSTALLED_KEY, INSTALLED_DAYS);
}

function markInstalled() {
  setNow(INSTALLED_KEY);
}

// Link "intent://" adalah cara resmi Android untuk memaksa buka URL
// memakai Chrome, walau sedang berada di dalam jendela mini app lain —
// jauh lebih mulus daripada minta customer cari menu "Buka di browser"
// sendiri (yang naruhnya beda-beda tiap app).
function buildAndroidChromeIntentUrl(): string {
  if (typeof window === "undefined") return "";
  const { location } = window;
  const withoutScheme = `${location.host}${location.pathname}${location.search}`;
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
    location.href
  )};end`;
}

// Halaman-halaman di mana banner ini TIDAK relevan (area kerja
// admin/barber, bukan customer awam yang jadi target fitur ini).
const HIDDEN_PREFIXES = ["/admin", "/barber", "/login"];

export function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Daftarkan service worker SEDINI & SESERING mungkin, di halaman apa pun —
  // sebelumnya SW baru terdaftar begitu customer buka halaman Profil, jadi
  // kalau mereka gak pernah ke sana, salah satu syarat wajib Chrome untuk
  // menawarkan instalasi (SW aktif) belum terpenuhi sama sekali. Registrasi
  // ini TIDAK memunculkan izin/prompt apa pun ke customer — beda dengan
  // subscribe notifikasi yang tetap butuh tap tombol sendiri di NotificationToggle.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Beberapa in-app WebView tidak mengizinkan SW sama sekali — abaikan,
      // tidak fatal, banner "buka di browser" di bawah tetap jalan.
    });
  }, []);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently() || wasRecentlyInstalled()) return;

    // ── Kasus 3: dibuka dari dalam app lain (WA/IG/FB/TikTok, dst) ──
    // Ini dicek PALING AWAL karena beforeinstallprompt memang tidak akan
    // pernah muncul di kondisi ini — percuma menunggunya.
    if (isInAppBrowser()) {
      const t = setTimeout(() => {
        setMode(isIOS() ? "inapp-ios" : "inapp-android");
        setVisible(true);
      }, 1200);
      return () => clearTimeout(t);
    }

    // ── Kasus 2: iOS Safari asli ──
    if (isIOS()) {
      const t = setTimeout(() => {
        setMode("ios");
        setVisible(true);
      }, 1200);
      return () => clearTimeout(t);
    }

    // ── Kasus 1: tunggu event native dari Chrome/Edge/Samsung Internet ──
    let gotNativeEvent = false;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      gotNativeEvent = true;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("native");
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
      markInstalled();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // ── Kasus 4: browser tidak pernah kirim event itu sama sekali (mis.
    // Firefox Android, atau Chrome yang menahan prompt karena heuristik
    // engagement-nya sendiri) — dikasih waktu 4.5 detik, kalau event tetap
    // tidak datang, tampilkan fallback instruksi manual generik.
    const fallbackTimer = setTimeout(() => {
      if (!gotNativeEvent) {
        setMode("manual");
        setVisible(true);
      }
    }, 4500);

    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setSheetOpen(false);
    markDismissed();
  }, []);

  const handlePrimaryAction = useCallback(async () => {
    if (mode === "native") {
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
      return;
    }
    // Mode ios / inapp-ios / manual: tidak ada API otomatis, jadi tombol
    // utama cuma membuka panduan langkah manual.
    setSheetOpen(true);
  }, [mode, deferredPrompt]);

  const hiddenHere = HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p));
  const canShow = !hiddenHere && visible && mode !== null;

  if (!canShow && !sheetOpen) return null;

  const BANNER_TEXT: Record<Mode, { title: string; subtitle: string; cta: string }> = {
    native: {
      title: "Instal App Glori Barbershop",
      subtitle: "Booking lebih cepat, langsung dari layar utama HP",
      cta: "Instal",
    },
    ios: {
      title: "Instal App Glori Barbershop",
      subtitle: "Booking lebih cepat, langsung dari layar utama HP",
      cta: "Instal",
    },
    manual: {
      title: "Instal App Glori Barbershop",
      subtitle: "Booking lebih cepat, langsung dari layar utama HP",
      cta: "Cara Instal",
    },
    "inapp-android": {
      title: "Buka di Chrome dulu, yuk",
      subtitle: "Supaya bisa langsung instal app dari sini",
      cta: "Buka di Chrome",
    },
    "inapp-ios": {
      title: "Buka di Safari dulu, yuk",
      subtitle: "Supaya bisa instal app dari sini",
      cta: "Caranya",
    },
  };

  const text = mode ? BANNER_TEXT[mode] : null;

  return (
    <>
      {/* ── Banner mengambang di atas BottomNav ── */}
      {canShow && !sheetOpen && text && (
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
              <p className="truncate text-[13px] font-bold text-text-primary">{text.title}</p>
              <p className="truncate text-[11px] text-text-secondary">{text.subtitle}</p>
            </div>

            {mode === "inapp-android" ? (
              // Android di dalam WebView app lain: langsung lempar ke Chrome
              // beneran lewat Android Intent — tidak perlu buka sheet dulu.
              <a
                href={buildAndroidChromeIntentUrl()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-bold text-text-onLight-primary transition-transform active:scale-[0.97]"
              >
                <ExternalLink size={15} strokeWidth={2.4} />
                {text.cta}
              </a>
            ) : (
              <button
                onClick={handlePrimaryAction}
                disabled={installing}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[12px] font-bold text-text-onLight-primary transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                <Download size={15} strokeWidth={2.4} />
                {installing ? "..." : text.cta}
              </button>
            )}

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

      {/* ── Panduan langkah manual — isinya beda tergantung kenapa customer
          gak bisa dapat popup otomatis (iOS Safari, in-app browser iOS,
          atau browser yang gak dukung beforeinstallprompt sama sekali). ── */}
      {sheetOpen && mode && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl border-t border-border-soft bg-surface p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.5)]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-soft" />
            <p className="text-center text-[15px] font-bold text-text-primary">
              Instal App Glori Barbershop
            </p>

            {mode === "ios" && (
              <>
                <p className="mt-1 text-center text-[12px] text-text-secondary">
                  Di iPhone, Safari minta 2 tap manual — bawaan dari Apple, bukan dari kami
                </p>
                <div className="mt-5 space-y-3">
                  <SheetStep number={1}>
                    <span>Tap ikon</span>
                    <IconChip><Share size={15} /></IconChip>
                    <span>di bar bawah Safari</span>
                  </SheetStep>
                  <SheetStep number={2}>
                    <span>Pilih</span>
                    <IconChip><SquarePlus size={15} /></IconChip>
                    <span>&quot;Add to Home Screen&quot;</span>
                  </SheetStep>
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-text-tertiary">
                  <MoreVertical size={12} className="rotate-90" />
                  Pakai Chrome/browser lain di iPhone? Caranya sama, cari ikon Share serupa
                </p>
              </>
            )}

            {mode === "inapp-ios" && (
              <>
                <p className="mt-1 text-center text-[12px] text-text-secondary">
                  Ini bukaan bawaan dari app tempat kamu klik link tadi (WA/IG/dsb),
                  bukan Safari asli — jadi perlu 1 langkah pindah dulu
                </p>
                <div className="mt-5 space-y-3">
                  <SheetStep number={1}>
                    <span>Tap ikon</span>
                    <IconChip><MoreVertical size={15} /></IconChip>
                    <span>(titik tiga) di pojok layar</span>
                  </SheetStep>
                  <SheetStep number={2}>
                    <span>Pilih &quot;Buka di Safari&quot; / &quot;Open in Safari&quot;</span>
                  </SheetStep>
                </div>
                <p className="mt-4 text-center text-[11px] text-text-tertiary">
                  Setelah kebuka di Safari, tap tombol Instal yang muncul lagi ya
                </p>
              </>
            )}

            {mode === "manual" && (
              <>
                <p className="mt-1 text-center text-[12px] text-text-secondary">
                  Browser kamu belum mendukung instal 1-tap otomatis — tapi tetap bisa
                  instal manual lewat menu browser
                </p>
                <div className="mt-5 space-y-3">
                  <SheetStep number={1}>
                    <span>Tap ikon</span>
                    <IconChip><MoreVertical size={15} /></IconChip>
                    <span>di pojok kanan atas browser</span>
                  </SheetStep>
                  <SheetStep number={2}>
                    <span>Pilih &quot;Instal aplikasi&quot; / &quot;Tambahkan ke Layar Utama&quot;</span>
                  </SheetStep>
                </div>
              </>
            )}

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

function SheetStep({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface-2 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-text-primary">
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[13px] text-text-primary">
        {children}
      </div>
    </div>
  );
}

function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface">
      {children}
    </span>
  );
}

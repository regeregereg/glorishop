"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Deteksi Safari iOS — Safari < 16.4 tidak mendukung Push API sama sekali.
 * Safari >= 16.4 mendukung tapi harus dari interaksi user (tidak bisa
 * auto-request), jadi kita tetap tampilkan tombol.
 */
function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Cek apakah browser ini mendukung Push Notification.
 * Safari iOS < 16.4 mengembalikan false.
 */
function isPushSupported() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  // Notification API harus ada
  if (!("Notification" in window)) return false;
  return true;
}

/**
 * Komponen notifikasi dengan dua mode:
 * 1. Auto-subscribe: kalau browser sudah pernah mengizinkan (permission=granted),
 *    langsung subscribe tanpa perlu interaksi user.
 * 2. Manual: kalau belum pernah mengizinkan, tampilkan tombol.
 *
 * Safari iOS (>= 16.4): Web Push didukung tapi HARUS dipicu dari interaksi
 * user langsung (tap/click), tidak bisa dipanggil dari useEffect otomatis.
 * Untuk itu, auto-subscribe hanya berjalan di non-Safari, dan Safari
 * selalu menampilkan tombol.
 */
export function NotificationToggle() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Fungsi inti: subscribe ke push server
  const doSubscribe = useCallback(async (): Promise<boolean> => {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setError("Konfigurasi notifikasi belum lengkap. Hubungi admin.");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Bersihkan subscription lama yang mungkin sudah expired/stale
      const staleSubscription = await registration.pushManager.getSubscription();
      if (staleSubscription) {
        await staleSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Gagal menyimpan langganan notifikasi.");
        await subscription.unsubscribe();
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      const message = err instanceof Error ? err.message : "";
      // DOMException: NotAllowedError = user blokir di level OS, bukan level browser
      if (message.includes("NotAllowedError") || message.includes("not allowed")) {
        setError("Notifikasi diblokir di pengaturan. Buka Pengaturan HP → Notifikasi → aktifkan untuk browser ini.");
      } else {
        setError(message ? `Gagal mengaktifkan: ${message}` : "Gagal mengaktifkan notifikasi. Coba lagi.");
      }
      return false;
    }
  }, []);

  useEffect(() => {
    async function init() {
      if (!isPushSupported()) {
        setPermission("unsupported");
        setLoading(false);
        return;
      }

      const currentPermission = Notification.permission as PermissionState;
      setPermission(currentPermission);

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existingSub = await registration.pushManager.getSubscription();

        if (existingSub) {
          // Sudah subscribe — sinkronisasi ke server (kalau misalnya endpoint
          // berubah setelah browser update atau app di-reinstall)
          setIsSubscribed(true);

          // Re-sync subscription ke server secara diam-diam
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: existingSub.toJSON() }),
          }).catch(() => {/* silent — tidak critical */});

        } else if (currentPermission === "granted" && !isSafari()) {
          // AUTO-SUBSCRIBE: izin sudah ada, belum ada subscription aktif,
          // dan bukan Safari (Safari butuh user gesture).
          // Langsung subscribe tanpa perlu interaksi user.
          await doSubscribe();
        }
      } catch (err) {
        console.error("SW init error:", err);
        // Service worker gagal — biarkan tombol tampil, user bisa coba manual
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [doSubscribe]);

  async function handleEnable() {
    setBusy(true);
    setError("");
    try {
      // Untuk Safari iOS, requestPermission HARUS dipanggil dari sini
      // (langsung dari event handler click), bukan dari useEffect.
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PermissionState);

      if (permissionResult !== "granted") {
        if (permissionResult === "denied") {
          setError("Notifikasi diblokir. Buka Pengaturan HP → Notifikasi → aktifkan untuk browser ini, lalu coba lagi.");
        } else {
          setError("Izin notifikasi tidak diberikan. Coba lagi jika berubah pikiran.");
        }
        return;
      }

      await doSubscribe();
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {
      setError("Gagal menonaktifkan notifikasi. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  // Browser tidak mendukung sama sekali — sembunyikan
  if (permission === "unsupported") return null;

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
        <Loader2 size={18} className="animate-spin text-text-tertiary" />
        <span className="text-sm text-text-secondary">Menyiapkan notifikasi...</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
      <button
        onClick={isSubscribed ? handleDisable : handleEnable}
        disabled={busy || permission === "denied"}
        className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <BellRing size={18} className="text-accent" />
          ) : (
            <Bell size={18} className="text-text-tertiary" />
          )}
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {isSubscribed ? "Notifikasi aktif" : "Aktifkan Notifikasi"}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {permission === "denied"
                ? "Notifikasi diblokir — buka Pengaturan HP untuk mengizinkan"
                : isSubscribed
                  ? "Kamu akan langsung dapat update status booking"
                  : isSafari()
                    ? "Tap di sini untuk aktifkan notifikasi (Safari)"
                    : "Dapatkan notifikasi booking langsung di HP"}
            </p>
          </div>
        </div>
        {busy ? (
          <Loader2 size={16} className="animate-spin text-text-tertiary" />
        ) : isSubscribed ? (
          <BellOff size={16} className="text-text-tertiary" />
        ) : null}
      </button>
      {error && <p className="mt-2 text-xs text-status-cancelled">{error}</p>}
    </div>
  );
}

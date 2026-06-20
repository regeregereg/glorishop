"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Tombol untuk mengaktifkan/menonaktifkan web push notification.
 * Menangani seluruh siklus: registrasi Service Worker, permintaan izin
 * browser, pembuatan subscription, dan sinkronisasi ke server.
 *
 * Pelanggan/staff HARUS sudah login (sesi cookie aktif) sebelum subscription
 * bisa disimpan — lihat /api/push/subscribe.
 */
export function NotificationToggle() {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setPermission("unsupported");
        setLoading(false);
        return;
      }

      setPermission(Notification.permission as PermissionState);

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existingSub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!existingSub);
      } catch {
        // Service worker gagal register — anggap belum subscribe, tombol
        // tetap tampil supaya user bisa coba lagi.
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError("");
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PermissionState);

      if (permissionResult !== "granted") {
        setError("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser jika berubah pikiran.");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError("Konfigurasi notifikasi belum lengkap. Hubungi admin.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Kalau ada subscription lama yang "nyangkut" di browser (mis. dari
      // percobaan sebelumnya yang gagal di tengah jalan), bersihkan dulu
      // supaya tidak konflik saat membuat subscription baru.
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
        return;
      }

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe error:", err);
      const message = err instanceof Error ? err.message : "";
      setError(
        message
          ? `Gagal mengaktifkan notifikasi: ${message}`
          : "Gagal mengaktifkan notifikasi. Coba lagi."
      );
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

  if (permission === "unsupported") return null; // browser tidak mendukung, sembunyikan saja

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3.5">
        <Loader2 size={18} className="animate-spin text-text-tertiary" />
        <span className="text-sm text-text-secondary">Memeriksa status notifikasi...</span>
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
                ? "Izin diblokir — ubah lewat pengaturan browser"
                : isSubscribed
                  ? "Dapatkan update status booking di perangkat ini"
                  : "Dapat update booking tanpa buka WhatsApp"}
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

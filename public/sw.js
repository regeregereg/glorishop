// Service Worker untuk Web Push Notification — Glori Barbershop.
// File ini berjalan di background browser, terpisah dari halaman web biasa,
// dan TETAP AKTIF walau tab/app sedang tertutup (selama browser/OS masih
// berjalan). Tidak perlu build step apa pun — file statis biasa.

self.addEventListener("install", () => {
  // Langsung aktifkan service worker baru tanpa menunggu tab lama ditutup.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Event utama: browser menerima push message terenkripsi dari server kita
// (dikirim lewat src/lib/push.ts menggunakan VAPID keys).
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Glori Barbershop", body: event.data.text() };
  }

  const title = payload.title || "Glori Barbershop";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "glori-notification",
    renotify: true,
    data: { url: payload.url || "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Saat notifikasi diklik: fokus ke tab yang sudah terbuka kalau ada,
// kalau tidak buka tab baru ke URL yang relevan (mis. halaman status booking).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// Fetch handler minimal — WAJIB ADA untuk Safari iOS agar SW diakui sebagai
// "push-capable" service worker. Tanpa event ini Safari menolak registrasi SW.
self.addEventListener("fetch", () => {
  return; // tidak intercept apa pun
});

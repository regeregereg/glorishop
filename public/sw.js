// Service Worker untuk Web Push Notification — Glori Barbershop.
// Berjalan di background browser, terpisah dari halaman web biasa.
// Aktif bahkan saat tab tertutup (selama browser/OS berjalan).
// Kompatibel: Chrome, Firefox, Edge, dan Safari iOS >= 16.4.

self.addEventListener("install", () => {
  // Langsung aktifkan service worker baru tanpa tunggu tab lama ditutup.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Event utama: browser menerima push message terenkripsi dari server
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
    // renotify: true supaya notifikasi baru tampil meski tag sama
    // (Safari iOS kadang suppress kalau tag sama tanpa renotify)
    renotify: true,
    data: { url: payload.url || "/" },
    vibrate: [100, 50, 100],
    // requireInteraction: notif tidak hilang otomatis (khusus desktop)
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Saat notifikasi diklik: fokus tab yang sudah terbuka, atau buka tab baru.
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

// Fetch handler minimal — wajib ada untuk Safari iOS agar SW diakui valid
// sebagai "push-capable" service worker. Tanpa ini, Safari bisa reject.
self.addEventListener("fetch", () => {
  // Tidak intercept apa pun — cukup ada agar SW valid.
  return;
});

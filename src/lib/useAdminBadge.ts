"use client";

import { useEffect, useState } from "react";

interface AdminBadgeCounts {
  pendingPaymentCount: number;
  unreadNotificationCount: number;
}

// Hook kecil untuk polling badge notifikasi admin (jumlah pembayaran
// menunggu verifikasi + notifikasi belum dibaca), dipakai bersama oleh
// AdminSidebar (desktop) dan AdminMobileBar (mobile) supaya admin selalu
// lihat ada hal yang butuh perhatian dari MANAPUN dia berada di dalam
// dashboard admin, tidak cuma saat membuka halaman Dashboard saja.
// Polling 20 detik — sama dengan interval di halaman Dashboard, supaya
// konsisten dan tidak membebani server lebih dari yang sudah ada.
export function useAdminBadgeCounts(): AdminBadgeCounts {
  const [counts, setCounts] = useState<AdminBadgeCounts>({
    pendingPaymentCount: 0,
    unreadNotificationCount: 0,
  });

  useEffect(() => {
    let active = true;
    function load() {
      fetch("/api/admin-stats/badge")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d) setCounts(d);
        })
        .catch(() => {
          // Diamkan — badge yang gagal di-refresh cuma menampilkan angka
          // lama, tidak fatal, akan dicoba lagi di siklus berikutnya.
        });
    }
    load();
    const interval = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return counts;
}

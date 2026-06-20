-- ============================================================================
-- MIGRATION: WEB PUSH NOTIFICATIONS (gratis, tanpa API berbayar)
-- ============================================================================
-- Jalankan file ini di Supabase SQL Editor SETELAH schema.sql.
-- Aman dijalankan ulang (idempotent).
--
-- RINGKASAN ALUR:
-- 1. Pelanggan (atau staff) membuka web app dan menekan tombol "Aktifkan
--    Notifikasi". Browser meminta izin notifikasi.
-- 2. Kalau diizinkan, browser membuat "push subscription" (endpoint unik +
--    kunci enkripsi) lewat Service Worker, lalu dikirim ke
--    POST /api/push/subscribe dan disimpan di tabel ini.
-- 3. Saat ada event penting (booking dikonfirmasi, status berubah, dll),
--    server memanggil lib/push.ts yang mengirim notifikasi terenkripsi ke
--    SEMUA endpoint milik user/staff terkait via library `web-push` (pakai
--    VAPID keys — gratis, bukan API berbayar seperti WhatsApp Business API).
-- 4. Service Worker (public/sw.js) di browser pelanggan menerima push event
--    dan menampilkan notifikasi sistem, meski tab/app sedang tertutup
--    (selama browser/OS masih berjalan di background).
--
-- CATATAN PENTING (perlu dipahami sebelum mengandalkan ini sebagai satu-
-- satunya channel notifikasi):
-- - Pelanggan HARUS mengizinkan notifikasi terlebih dahulu (tidak otomatis).
-- - Di iOS Safari, push notification HANYA berfungsi jika pelanggan sudah
--   "Add to Home Screen" (install sebagai PWA) — iOS 16.4 ke atas.
-- - Kalau pelanggan uninstall/clear browser data, subscription jadi tidak
--   valid lagi (endpoint akan otomatis dibersihkan saat pengiriman gagal).
-- - Untuk notifikasi yang KRUSIAL (mis. konfirmasi booking), tetap
--   pertimbangkan WhatsApp sebagai channel utama; web push cocok sebagai
--   pelengkap gratis, bukan pengganti total.

-- 1. TABEL: push_subscriptions -------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- subscription bisa dimiliki oleh pelanggan (user) ATAU staff (admin/barber),
  -- persis satu di antara keduanya harus terisi.
  user_id uuid references public.users(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,   -- kunci publik enkripsi dari browser
  auth text not null,     -- auth secret dari browser
  user_agent text,        -- info device, untuk debugging ("iPhone Safari", dst)
  created_at timestamptz not null default now(),
  check (
    (user_id is not null and staff_id is null) or
    (user_id is null and staff_id is not null)
  )
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_staff on public.push_subscriptions(staff_id);

-- 2. ROW LEVEL SECURITY --------------------------------------------------------
alter table public.push_subscriptions enable row level security;
-- Tidak ada policy publik: semua akses lewat service_role di server (API
-- routes /api/push/*), konsisten dengan pola tabel lain di project ini.

-- ============================================================================
-- UPDATE KREDENSIAL ADMIN — username & password baru
-- ============================================================================
-- Jalankan di Supabase SQL Editor. Password baru sudah di-hash dengan
-- bcrypt (cost factor 10, sama dengan yang dipakai sistem ini) — sudah
-- diverifikasi cocok sebelum dikirim, tidak perlu generate ulang.
--
-- PENTING: jalankan query langkah 1 dulu untuk melihat akun admin yang
-- ADA SAAT INI sebelum melakukan UPDATE, supaya yakin yang ter-update
-- adalah akun yang benar (terutama kalau ada lebih dari satu akun admin).

-- LANGKAH 1 — Lihat dulu akun admin yang ada saat ini (jangan skip ini).
select id, username, name, role, is_active
from public.staff
where role = 'admin';

-- LANGKAH 2 — Setelah yakin (lihat hasil Langkah 1), jalankan UPDATE ini.
-- Query ini akan meng-update SEMUA akun dengan role='admin'. Kalau ada
-- lebih dari satu akun admin dan kamu hanya ingin mengubah salah satunya,
-- tambahkan kondisi "and username = 'username_lama_di_sini'" di baris WHERE.
update public.staff
set
  username = 'adminglori26',
  password_hash = '$2b$10$pWsEVV88W8wMuzCmowrnBuWB/jtvfkWBm3cZ5jZCJlmaXOWCrtgQO'
where role = 'admin';

-- LANGKAH 3 — Verifikasi hasilnya (harus muncul 1 baris dengan username
-- baru di atas).
select id, username, name, role, is_active
from public.staff
where role = 'admin';

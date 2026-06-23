-- ============================================================================
-- GANTI USERNAME / PASSWORD ADMIN — template aman, pakai file ini saja
-- ============================================================================
-- File ini TIDAK menyentuh struktur tabel apa pun (tidak ada CREATE TABLE,
-- tidak ada INSERT seed data) — cuma UPDATE baris akun yang sudah ada.
-- Karena itu jauh lebih aman dijalankan kapan saja dibanding mengedit
-- schema.sql, yang isinya seluruh struktur database + seed data dan
-- berisiko menduplikasi data lagi kalau dijalankan ulang tanpa hati-hati.
--
-- CARA PAKAI:
-- 1. Generate hash password baru (lihat instruksi di bawah).
-- 2. Tempel hash itu ke placeholder GANTI_DENGAN_HASH_BARU di Langkah 2.
-- 3. Jalankan Langkah 1 dulu (cuma melihat, tidak mengubah apa pun).
-- 4. Jalankan Langkah 2 (UPDATE).
-- 5. Jalankan Langkah 3 untuk konfirmasi hasil.
--
-- CARA GENERATE HASH PASSWORD BARU:
-- Password TIDAK BOLEH disimpan polos (plain text) di database — selalu
-- dalam bentuk hash bcrypt. Kalau butuh ganti password lagi nanti dan
-- tidak punya cara generate hash sendiri, minta bantuan saya lagi di
-- chat ini, sebutkan password barunya, saya generate-kan hash bcrypt-nya
-- (sama seperti yang kemarin untuk 'masukglori123').

-- ============================================================================
-- LANGKAH 1 — Lihat akun admin yang ada SAAT INI (jangan skip)
-- ============================================================================
select id, username, name, role, is_active
from public.staff
where role = 'admin';

-- ============================================================================
-- LANGKAH 2 — Update username & password
-- ============================================================================
-- Ganti 'username_baru_di_sini' dan hash di bawah sesuai kebutuhan.
-- Kalau cuma mau ganti salah satu (misal cuma password, username tetap),
-- hapus saja baris yang tidak perlu diubah.
update public.staff
set
  username = 'username_baru_di_sini',
  password_hash = 'GANTI_DENGAN_HASH_BARU'
where role = 'admin';
-- Kalau ada LEBIH DARI SATU akun admin (cek hasil Langkah 1), tambahkan
-- baris berikut sebelum titik koma di atas supaya hanya akun yang dituju
-- yang ter-update:
--   and username = 'username_admin_yang_mau_diubah'

-- ============================================================================
-- LANGKAH 3 — Verifikasi hasil
-- ============================================================================
select id, username, name, role, is_active
from public.staff
where role = 'admin';

-- ============================================================================
-- BERSIHKAN BARIS DUPLIKAT — hapus permanen layanan & produk yang sudah
-- dinonaktifkan (is_active = false) akibat schema.sql sempat dijalankan
-- ulang dan menduplikasi seed data.
-- ============================================================================
-- Jalankan di Supabase SQL Editor. SELALU jalankan LANGKAH 1 (cek dulu)
-- sebelum LANGKAH 2 (hapus), supaya yakin baris yang terhapus benar.
--
-- CATATAN KEAMANAN:
-- - Tabel products TIDAK punya relasi/foreign key apa pun dari tabel lain
--   (lihat schema.sql) — aman dihapus permanen tanpa risiko merusak data
--   booking/transaksi.
-- - Tabel services DIPAKAI oleh bookings.service_id (on delete set null,
--   aman) dan booking_services.service_id (on delete restrict). Constraint
--   "restrict" ini otomatis MENOLAK penghapusan kalau ternyata ada booking
--   yang masih memakai layanan itu — jadi query DELETE di bawah aman
--   dijalankan; kalau ada baris yang "terlindungi" karena pernah dipakai
--   booking, Postgres akan memunculkan error dan TIDAK ada yang terhapus
--   sama sekali untuk baris itu (bukan terhapus sebagian/rusak).

-- ============================================================================
-- LANGKAH 1 — Lihat dulu apa saja yang akan terhapus (jangan skip ini)
-- ============================================================================
select id, name, price, is_active, created_at
from public.products
where is_active = false
order by name, created_at;

select id, name, price, is_active, created_at
from public.services
where is_active = false
order by name, created_at;

-- ============================================================================
-- LANGKAH 2 — Hapus permanen produk yang nonaktif
-- ============================================================================
delete from public.products
where is_active = false;

-- ============================================================================
-- LANGKAH 3 — Hapus permanen layanan yang nonaktif
-- ============================================================================
-- Kalau muncul error "violates foreign key constraint" di sini, artinya
-- ADA baris yang masih dipakai booking seseorang — JANGAN paksa hapus.
-- Kabari saya nama layanannya, supaya bisa dicek lebih lanjut sebelum
-- diputuskan langkah apa yang aman.
delete from public.services
where is_active = false;

-- ============================================================================
-- LANGKAH 4 — Verifikasi hasil akhir (harus 0 baris untuk keduanya)
-- ============================================================================
select count(*) as sisa_produk_nonaktif from public.products where is_active = false;
select count(*) as sisa_layanan_nonaktif from public.services where is_active = false;
